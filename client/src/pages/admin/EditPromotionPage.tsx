import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { promotionApi, type Promotion } from "../../api/promotionApi";
import { PromotionForm, toPromotionPayload, type PromotionFormData } from "./CreatePromotionPage";

function formFromPromotion(promotion: Promotion): PromotionFormData {
  return {
    code: promotion.code,
    name: promotion.name,
    description: promotion.description ?? "",
    discountType: promotion.priceRule.discountType,
    discountValue: String(promotion.priceRule.discountType === "PERCENTAGE" ? promotion.priceRule.percentage ?? "" : promotion.priceRule.fixedAmount ?? ""),
    maximumDiscount: promotion.priceRule.maxDiscountAmount == null ? "" : String(promotion.priceRule.maxDiscountAmount),
    minimumOrder: String(promotion.priceRule.minimumOrderAmount ?? 0),
    validFrom: promotion.validFrom?.slice(0, 10) ?? "",
    validUntil: promotion.validUntil?.slice(0, 10) ?? "",
    globalUsageLimit: promotion.globalUsageLimit == null ? "" : String(promotion.globalUsageLimit),
    perAccountUsageLimit: promotion.perAccountUsageLimit == null ? "" : String(promotion.perAccountUsageLimit),
  };
}

export default function EditPromotionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    promotionApi.get(id).then((value) => {
      if (value.status !== "DRAFT") setError("Only draft promotions can be edited.");
      else setPromotion(value);
    }).catch(() => setError("Promotion could not be loaded."));
  }, [id]);

  if (error) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-500">{error}</div>;
  if (!promotion || !id) return <p style={{ color: "var(--text-sub)" }}>Loading promotion...</p>;
  return <PromotionForm initial={formFromPromotion(promotion)} submitLabel="Edit promotion" onSubmit={async (form) => { const updated = await promotionApi.update(id, toPromotionPayload(form)); navigate(`/admin/promotions/${updated.promotionId}`); }} />;
}
