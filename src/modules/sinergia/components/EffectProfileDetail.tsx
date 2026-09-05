import { useState } from "react";
import { useBatchRun } from "../state/useBatchRun";
import ProfileHeader from "./ProfileHeader";
import ItemsTab from "./ItemsTab";
import OthersTab from "./OthersTab";
import CheckInPanel from "./CheckInPanel";
import CriteriaLinksPanel from "./CriteriaLinksPanel";
import DiagnosisPanel from "./DiagnosisPanel";
import ItemDetailPage from "./ItemDetailPage";
import CausalMapView from "./CausalMapView";

/**
 * Página de detalhe de um perfil de efeito: cabeçalho (voltar/renomear/
 * excluir/abas) em `ProfileHeader`, e o conteúdo de cada aba num componente
 * próprio (`ItemsTab`, `DiagnosisPanel`+`CheckInPanel`+`CriteriaLinksPanel`,
 * `OthersTab`) — este arquivo só guarda o que É compartilhado entre abas:
 * a fila de lote (`batch`, usada tanto pra preencher critério em massa quanto
 * pra detectar interações) e os dois "sub-telas" que substituem a página
 * inteira (item aberto, mapa causal).
 */
export default function EffectProfileDetail({
  profile,
  onBack,
  onOpenInCognidex,
  onRenameProfile,
  onDeleteProfile,
  onAddCriterion,
  onRenameCriterion,
  onSetCriterionWeight,
  onSetCriterionHidden,
  onRemoveCriterion,
  onSetProfileSaturation,
  onAddItem,
  onRenameItem,
  onRemoveItem,
  onToggleItemActive,
  onSetItemHidden,
  onUpdateItemRating,
  onFillCriterionForItem,
  onUpdateItemNote,
  onSetItemVariant,
  onCacheItemExplain,
  onSetInteraction,
  onRemoveInteraction,
  onSetRatingMeta,
  onSetCriterionLink,
  onRemoveCriterionLink,
  onSetItemProtocol,
  onSetItemIndicators,
  onSetItemCost,
  onAddCheckIn,
  onRemoveCheckIn,
}: any) {
  const [tab, setTab] = useState("geral");
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [causalMapCriterionId, setCausalMapCriterionId] = useState<string | null>(null);

  const batch = useBatchRun();
  const hasCriteria = profile.criteria.length > 0;

  const openItem = openItemId ? profile.items.find((it: any) => it.id === openItemId) : null;
  if (openItem) {
    return (
      <ItemDetailPage
        item={openItem}
        profile={profile}
        onBack={() => setOpenItemId(null)}
        onRenameItem={(name: string) => onRenameItem(profile.id, openItem.id, name)}
        onUpdateItemNote={(note: string) => onUpdateItemNote(profile.id, openItem.id, note)}
        onUpdateItemRating={(critId: string, value: number) => onUpdateItemRating(profile.id, openItem.id, critId, value)}
        onSetItemVariant={(idx: number) => onSetItemVariant(profile.id, openItem.id, idx)}
        onCacheItemExplain={(critId: string, kind: string, text: string) => onCacheItemExplain(profile.id, openItem.id, critId, kind, text)}
        onSetItemProtocol={(protocol: any) => onSetItemProtocol(profile.id, openItem.id, protocol)}
        onSetItemCost={(cost: any) => onSetItemCost(profile.id, openItem.id, cost)}
      />
    );
  }

  if (causalMapCriterionId) {
    return <CausalMapView profile={profile} criterionId={causalMapCriterionId} onBack={() => setCausalMapCriterionId(null)} />;
  }

  return (
    <div>
      <ProfileHeader
        profile={profile}
        tab={tab}
        onTabChange={setTab}
        onBack={onBack}
        onOpenInCognidex={onOpenInCognidex}
        onRenameProfile={onRenameProfile}
        onDeleteProfile={onDeleteProfile}
      />

      {tab === "geral" && (
        <ItemsTab
          profile={profile}
          batch={batch}
          onAddCriterion={onAddCriterion}
          onRenameCriterion={onRenameCriterion}
          onSetCriterionWeight={onSetCriterionWeight}
          onSetCriterionHidden={onSetCriterionHidden}
          onRemoveCriterion={onRemoveCriterion}
          onSetProfileSaturation={onSetProfileSaturation}
          onOpenCausalMap={setCausalMapCriterionId}
          onAddItem={onAddItem}
          onRenameItem={onRenameItem}
          onRemoveItem={onRemoveItem}
          onToggleItemActive={onToggleItemActive}
          onSetItemHidden={onSetItemHidden}
          onSetItemVariant={onSetItemVariant}
          onFillCriterionForItem={onFillCriterionForItem}
          onSetRatingMeta={onSetRatingMeta}
          onOpenItem={setOpenItemId}
        />
      )}

      {tab === "diagnostico" && (
        <>
          <CheckInPanel profile={profile} onAddCheckIn={(observed: any, note: string) => onAddCheckIn(profile.id, observed, note)} onRemoveCheckIn={(id: string) => onRemoveCheckIn(profile.id, id)} />
          <DiagnosisPanel
            profile={profile}
            onAddItem={onAddItem}
            onAddCriterion={onAddCriterion}
            onFillCriterionForItem={onFillCriterionForItem}
            onSetRatingMeta={onSetRatingMeta}
            onSetCriterionLink={onSetCriterionLink}
            onSetItemProtocol={onSetItemProtocol}
            onSetItemIndicators={onSetItemIndicators}
            onUpdateItemNote={onUpdateItemNote}
          />
          {hasCriteria && <CriteriaLinksPanel profile={profile} onSetCriterionLink={onSetCriterionLink} onRemoveCriterionLink={onRemoveCriterionLink} />}
        </>
      )}

      {tab === "outros" && (
        <OthersTab
          profile={profile}
          batch={batch}
          onAddItem={onAddItem}
          onRemoveItem={onRemoveItem}
          onSetInteraction={onSetInteraction}
          onRemoveInteraction={onRemoveInteraction}
        />
      )}
    </div>
  );
}
