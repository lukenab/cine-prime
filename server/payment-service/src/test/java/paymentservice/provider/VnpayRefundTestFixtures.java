package paymentservice.provider;

import paymentservice.config.VnpayProperties;

import java.util.LinkedHashMap;
import java.util.Map;

final class VnpayRefundTestFixtures {
    private VnpayRefundTestFixtures() {
    }

    static VnpayProperties properties() {
        return new VnpayProperties(
                "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
                "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
                "http://localhost:8080/api/payments/vnpay/return",
                "DEMO1234",
                "a-test-hash-secret",
                "2.1.0",
                "vn",
                "Asia/Ho_Chi_Minh",
                "CinePrime",
                "127.0.0.1");
    }

    static Map<String, String> requestParameters() {
        Map<String, String> request = new LinkedHashMap<>();
        request.put("vnp_RequestId", "abc123");
        request.put("vnp_Version", "2.1.0");
        request.put("vnp_Command", "refund");
        request.put("vnp_TmnCode", "DEMO1234");
        request.put("vnp_TransactionType", "03");
        request.put("vnp_TxnRef", "CP123");
        request.put("vnp_Amount", "5000000");
        request.put("vnp_TransactionNo", "123456");
        request.put("vnp_TransactionDate", "20260802120000");
        request.put("vnp_CreateBy", "CinePrime");
        request.put("vnp_CreateDate", "20260802130000");
        request.put("vnp_IpAddr", "127.0.0.1");
        request.put("vnp_OrderInfo", "Refund booking BKG1");
        return request;
    }

    static Map<String, String> successResponse() {
        Map<String, String> response = new LinkedHashMap<>();
        response.put("vnp_ResponseId", "response123");
        response.put("vnp_Command", "refund");
        response.put("vnp_ResponseCode", "00");
        response.put("vnp_Message", "Success");
        response.put("vnp_TmnCode", "DEMO1234");
        response.put("vnp_TxnRef", "CP123");
        response.put("vnp_Amount", "5000000");
        response.put("vnp_BankCode", "NCB");
        response.put("vnp_PayDate", "20260802130100");
        response.put("vnp_TransactionNo", "987654");
        response.put("vnp_TransactionType", "03");
        response.put("vnp_TransactionStatus", "00");
        response.put("vnp_OrderInfo", "Refund booking BKG1");
        return response;
    }
}
