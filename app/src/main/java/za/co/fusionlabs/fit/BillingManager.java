package za.co.fusionlabs.fit;

import android.app.Activity;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Collections;
import java.util.List;

/**
 * Google Play Billing for Fusion Fit Pro: a subscription AND a one-off lifetime purchase.
 *
 * Play Console setup:
 *   Subscriptions → Product ID "fusionfit_pro", base plans "monthly" and "yearly"
 *                   (add a 7-day free-trial offer on "yearly")
 *   One-time products → Product ID "fusionfit_lifetime" (non-consumable)
 *
 * Results are sent to the app's JavaScript as window.HPBilling({...}).
 */
public class BillingManager implements PurchasesUpdatedListener {
    public static final String SUB_ID = "fusionfit_pro";
    public static final String LIFE_ID = "fusionfit_lifetime";

    public interface Sink { void send(JSONObject event); }

    private final Activity activity;
    private final Sink sink;
    private final BillingClient client;
    private ProductDetails subDetails;
    private ProductDetails lifeDetails;
    private boolean connecting = false;
    private Runnable afterConnect;
    private boolean subActive = false;
    private boolean lifeOwned = false;

    public BillingManager(Activity activity, Sink sink) {
        this.activity = activity;
        this.sink = sink;
        this.client = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
    }

    private void withConnection(Runnable task) {
        if (client.isReady()) { task.run(); return; }
        afterConnect = task;
        if (connecting) return;
        connecting = true;
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                connecting = false;
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    Runnable r = afterConnect;
                    afterConnect = null;
                    if (r != null) r.run();
                } else {
                    afterConnect = null;
                    sendError("unavailable", "Google Play billing isn't available on this phone (" + result.getDebugMessage() + ").");
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                connecting = false;
            }
        });
    }

    public void refresh() {
        withConnection(() -> {
            loadSubscription();
            loadLifetime();
            checkPurchases();
        });
    }

    private QueryProductDetailsParams query(String id, String type) {
        return QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(
                        QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(type).build()))
                .build();
    }

    private void loadSubscription() {
        client.queryProductDetailsAsync(query(SUB_ID, BillingClient.ProductType.SUBS), (result, queryResult) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                sendError("products", "Couldn't load prices from Google Play (" + result.getDebugMessage() + ").");
                return;
            }
            List<ProductDetails> list = queryResult.getProductDetailsList();
            if (list == null || list.isEmpty()) { sendSimple("not_listed"); return; }
            subDetails = list.get(0);
            sendPlans();
        });
    }

    private void loadLifetime() {
        client.queryProductDetailsAsync(query(LIFE_ID, BillingClient.ProductType.INAPP), (result, queryResult) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
            List<ProductDetails> list = queryResult.getProductDetailsList();
            if (list == null || list.isEmpty()) return;
            lifeDetails = list.get(0);
            try {
                JSONObject e = new JSONObject();
                e.put("type", "lifetime");
                ProductDetails.OneTimePurchaseOfferDetails o = lifeDetails.getOneTimePurchaseOfferDetails();
                e.put("price", o != null ? o.getFormattedPrice() : "");
                sink.send(e);
            } catch (JSONException ignored) { }
        });
    }

    private void sendPlans() {
        try {
            JSONArray plans = new JSONArray();
            List<ProductDetails.SubscriptionOfferDetails> offers = subDetails.getSubscriptionOfferDetails();
            if (offers != null) {
                for (ProductDetails.SubscriptionOfferDetails o : offers) {
                    JSONObject p = new JSONObject();
                    p.put("basePlanId", o.getBasePlanId());
                    p.put("offerId", o.getOfferId() == null ? "" : o.getOfferId());
                    JSONArray phases = new JSONArray();
                    for (ProductDetails.PricingPhase ph : o.getPricingPhases().getPricingPhaseList()) {
                        JSONObject j = new JSONObject();
                        j.put("price", ph.getFormattedPrice());
                        j.put("micros", ph.getPriceAmountMicros());
                        j.put("currency", ph.getPriceCurrencyCode());
                        j.put("period", ph.getBillingPeriod());
                        j.put("cycles", ph.getBillingCycleCount());
                        phases.put(j);
                    }
                    p.put("phases", phases);
                    plans.put(p);
                }
            }
            JSONObject e = new JSONObject();
            e.put("type", "plans");
            e.put("plans", plans);
            sink.send(e);
        } catch (JSONException ignored) { }
    }

    /** plan: "monthly", "yearly" or "lifetime" */
    public void buy(String plan) {
        withConnection(() -> {
            BillingFlowParams.ProductDetailsParams pdp;
            if ("lifetime".equals(plan)) {
                if (lifeDetails == null) { sendSimple("not_listed"); return; }
                pdp = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(lifeDetails).build();
            } else {
                if (subDetails == null) { sendSimple("not_listed"); return; }
                String token = null, baseOnly = null;
                List<ProductDetails.SubscriptionOfferDetails> offers = subDetails.getSubscriptionOfferDetails();
                if (offers != null) {
                    for (ProductDetails.SubscriptionOfferDetails o : offers) {
                        if (!plan.equals(o.getBasePlanId())) continue;
                        if (o.getOfferId() != null) token = o.getOfferToken(); else baseOnly = o.getOfferToken();
                    }
                }
                if (token == null) token = baseOnly;
                if (token == null) { sendError("plan", "That plan isn't available right now."); return; }
                pdp = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(subDetails).setOfferToken(token).build();
            }
            BillingFlowParams flow = BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(pdp)).build();
            BillingResult r = client.launchBillingFlow(activity, flow);
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                sendError("launch", "Couldn't open Google Play checkout (" + r.getDebugMessage() + ").");
            }
        });
    }

    /** Checks Google Play for an active subscription and a lifetime purchase. */
    public void checkPurchases() {
        withConnection(() -> client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (r1, subs) -> {
                    if (r1.getResponseCode() == BillingClient.BillingResponseCode.OK) subActive = false;
                    client.queryPurchasesAsync(
                            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                            (r2, inapp) -> {
                                if (r2.getResponseCode() == BillingClient.BillingResponseCode.OK) lifeOwned = false;
                                boolean pending = apply(subs) | apply(inapp);
                                sendEntitlement(pending, true);
                            });
                }));
    }

    /** Updates the flags from a purchase list; returns true if any purchase is pending. */
    private boolean apply(List<Purchase> purchases) {
        boolean pending = false;
        if (purchases == null) return false;
        for (Purchase p : purchases) {
            boolean isSub = p.getProducts().contains(SUB_ID), isLife = p.getProducts().contains(LIFE_ID);
            if (!isSub && !isLife) continue;
            int state = p.getPurchaseState();
            if (state == Purchase.PurchaseState.PURCHASED) {
                if (isSub) subActive = true;
                if (isLife) lifeOwned = true;
                if (!p.isAcknowledged()) acknowledge(p);
            } else if (state == Purchase.PurchaseState.PENDING) {
                pending = true;
            }
        }
        return pending;
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            boolean pending = apply(purchases);
            sendEntitlement(pending, false);
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            sendSimple("cancelled");
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            checkPurchases();
        } else {
            sendError("purchase", "The payment didn't go through (" + result.getDebugMessage() + ").");
        }
    }

    private void sendEntitlement(boolean pending, boolean restore) {
        try {
            JSONObject e = new JSONObject();
            e.put("type", "entitlement");
            e.put("active", subActive);
            e.put("lifetime", lifeOwned);
            e.put("pending", pending);
            e.put("restore", restore);
            sink.send(e);
        } catch (JSONException ignored) { }
    }

    private void acknowledge(Purchase p) {
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build();
        client.acknowledgePurchase(params, r -> { /* Google refunds unacknowledged purchases after 3 days */ });
    }

    private void sendSimple(String type) {
        try { JSONObject e = new JSONObject(); e.put("type", type); sink.send(e); } catch (JSONException ignored) { }
    }

    private void sendError(String where, String message) {
        try { JSONObject e = new JSONObject(); e.put("type", "error"); e.put("where", where); e.put("message", message); sink.send(e); } catch (JSONException ignored) { }
    }

    public void destroy() {
        if (client.isReady()) client.endConnection();
    }
}
