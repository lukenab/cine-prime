package userservice.util;

public final class IdentityCardMasker {

    private IdentityCardMasker() {
    }

    public static String mask(String identityCard) {
        if (identityCard == null || identityCard.length() < 6) {
            return identityCard;
        }

        return identityCard.substring(0, 3)
                + "*".repeat(identityCard.length() - 6)
                + identityCard.substring(identityCard.length() - 3);
    }
}
