import { useEffect, useState } from "react";
import { promotionApi, type PublicPromotionOffer } from "../api/promotionApi";

export function usePublicPromotionOffers() {
  const [offers, setOffers] = useState<PublicPromotionOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    promotionApi.listPublicOffers()
      .then((result) => {
        if (!active) return;
        setOffers(result);
        setError(false);
      })
      .catch(() => {
        if (!active) return;
        setOffers([]);
        setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return { offers, loading, error };
}
