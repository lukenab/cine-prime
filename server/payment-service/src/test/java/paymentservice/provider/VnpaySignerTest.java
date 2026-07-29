package paymentservice.provider;

import org.junit.jupiter.api.Test;
import paymentservice.config.VnpayProperties;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class VnpaySignerTest {
    private final VnpaySigner signer = new VnpaySigner(new VnpayProperties(
            "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
            "http://localhost:8080/api/payments/vnpay/return",
            "DEMO1234",
            "a-test-hash-secret",
            "2.1.0",
            "vn",
            "Asia/Ho_Chi_Minh"));

    @Test
    void generatedUrlContainsSignatureThatCanBeVerified() {
        Map<String, String> parameters = new HashMap<>();
        parameters.put("vnp_TmnCode", "DEMO1234");
        parameters.put("vnp_TxnRef", "CP123");
        parameters.put("vnp_Amount", "9000000");
        parameters.put("vnp_OrderInfo", "CinePrime booking BKG-1");

        String paymentUrl = signer.buildPaymentUrl(parameters);
        String signature = paymentUrl.substring(
                paymentUrl.indexOf("vnp_SecureHash=") + "vnp_SecureHash=".length());
        parameters.put("vnp_SecureHash", signature);

        assertThat(signer.valid(parameters)).isTrue();
    }

    @Test
    void changedCallbackValueInvalidatesSignature() {
        Map<String, String> parameters = new HashMap<>();
        parameters.put("vnp_TxnRef", "CP123");
        parameters.put("vnp_Amount", "9000000");

        String paymentUrl = signer.buildPaymentUrl(parameters);
        String signature = paymentUrl.substring(
                paymentUrl.indexOf("vnp_SecureHash=") + "vnp_SecureHash=".length());
        parameters.put("vnp_SecureHash", signature);
        parameters.put("vnp_Amount", "100");

        assertThat(signer.valid(parameters)).isFalse();
    }
}
