package paymentservice.provider;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class VnpayRefundSignerTest {
    private final VnpayRefundSigner signer = new VnpayRefundSigner(VnpayRefundTestFixtures.properties());

    @Test
    void signsRefundRequestInProviderSpecifiedFieldOrder() {
        Map<String, String> request = VnpayRefundTestFixtures.requestParameters();

        assertThat(signer.canonicalRequest(request)).isEqualTo(
                "abc123|2.1.0|refund|DEMO1234|03|CP123|5000000|123456|"
                        + "20260802120000|CinePrime|20260802130000|127.0.0.1|Refund booking BKG1");
        assertThat(signer.signRequest(request)).hasSize(128);
    }

    @Test
    void validatesRefundResponseAndRejectsTampering() {
        Map<String, String> response = new LinkedHashMap<>(VnpayRefundTestFixtures.successResponse());
        response.put("vnp_SecureHash", signer.signResponse(response));
        assertThat(signer.validResponse(response)).isTrue();

        response.put("vnp_Amount", "1");
        assertThat(signer.validResponse(response)).isFalse();
    }

    @Test
    void treatsProviderNullFieldsAsEmptyWhenValidatingResponse() {
        Map<String, String> response = new LinkedHashMap<>(
                VnpayRefundTestFixtures.successResponse());
        response.put("vnp_ResponseCode", "91");
        response.put("vnp_Message", "Transaction not found");
        response.put("vnp_BankCode", null);
        response.put("vnp_PayDate", null);
        response.put("vnp_TransactionNo", null);
        response.put("vnp_TransactionStatus", null);
        assertThat(signer.canonicalResponse(response)).isEqualTo(
                "response123|refund|91|Transaction not found|DEMO1234|CP123|"
                        + "5000000||||03||Refund booking BKG1");
        response.put("vnp_SecureHash", signer.signResponse(response));

        assertThat(signer.validResponse(response)).isTrue();
    }
}
