import React, { useMemo, useState } from "react";

const PITY_LIMIT = 10;

const CHESTS = {
  bronze: {
    id: "bronze",
    name: "銅寶箱",
    cost: 200,
    pool: [
      { rank: "SSS", points: 1440, rate: 0.01 },
      { rank: "S", points: 250, rate: 0.10 },
      { rank: "A", points: 100, rate: 0.39 },
      { rank: "B", points: 40, rate: 0.50 },
    ],
  },
  silver: {
    id: "silver",
    name: "銀寶箱",
    cost: 500,
    pool: [
      { rank: "SSS", points: 3600, rate: 0.02 },
      { rank: "S", points: 600, rate: 0.15 },
      { rank: "A", points: 250, rate: 0.33 },
      { rank: "B", points: 100, rate: 0.50 },
    ],
  },
  gold: {
    id: "gold",
    name: "金寶箱",
    cost: 1000,
    pool: [
      { rank: "SSS", points: 7200, rate: 0.03 },
      { rank: "S", points: 1500, rate: 0.20 },
      { rank: "A", points: 600, rate: 0.37 },
      { rank: "B", points: 200, rate: 0.40 },
    ],
  },
};

function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>{title}</h3>
          <button type="button" onClick={onClose} style={styles.iconBtn}>
            關閉
          </button>
        </div>
        <div style={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.detail?.message || json.message || "發生錯誤";
    throw new Error(msg);
  }
  return json;
}

export default function GachaChestSystem({ userId = "郭芸甄" }) {
  const [pityCounter, setPityCounter] = useState({ bronze: 0, silver: 0, gold: 0 });
  const [loadingPity, setLoadingPity] = useState(true);
  const [probModalChest, setProbModalChest] = useState(null);
  const [resultModal, setResultModal] = useState({ open: false, chestId: null, reward: null, guaranteed: false });
  const [isDrawing, setIsDrawing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const chestList = useMemo(() => Object.values(CHESTS), []);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingPity(true);
        const data = await api(`/api/gacha/pity/${encodeURIComponent(userId)}`);
        if (!alive) return;
        setPityCounter({
          bronze: Number(data.bronze || 0),
          silver: Number(data.silver || 0),
          gold: Number(data.gold || 0),
        });
      } catch (err) {
        if (!alive) return;
        setErrorMsg(err.message || "讀取保底失敗");
      } finally {
        if (alive) setLoadingPity(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const drawGacha = (chestId) => {
    if (!CHESTS[chestId]) return;

    (async () => {
      try {
        setErrorMsg("");
        setIsDrawing(true);
        const result = await api(`/api/gacha/draw/${encodeURIComponent(userId)}`, {
          method: "POST",
          body: JSON.stringify({ chest_type: chestId }),
        });

        setPityCounter((prev) => ({
          ...prev,
          [chestId]: Number(result.pity_after || 0),
        }));

        setResultModal({
          open: true,
          chestId,
          reward: result.reward,
          guaranteed: !!result.guaranteed,
        });
      } catch (err) {
        setErrorMsg(err.message || "抽獎失敗");
      } finally {
        setIsDrawing(false);
      }
    })();
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>寶箱抽獎</h2>
      <p style={styles.subtitle}>10 抽保底 SSS。抽到 SSS 會重置該寶箱保底計數。</p>
      {loadingPity && <p style={styles.info}>讀取保底資料中...</p>}
      {!!errorMsg && <p style={styles.error}>{errorMsg}</p>}

      <div style={styles.grid}>
        {chestList.map((chest) => {
          const pity = pityCounter[chest.id] || 0;
          const remain = Math.max(0, PITY_LIMIT - pity);

          return (
            <div key={chest.id} style={styles.card}>
              <h3 style={styles.cardTitle}>{chest.name}</h3>
              <p style={styles.cost}>消耗 {chest.cost} 點</p>
              <p style={styles.pity}>保底進度: {pity}/{PITY_LIMIT} (剩餘 {remain} 抽)</p>

              <div style={styles.btnRow}>
                <button type="button" style={styles.secondaryBtn} onClick={() => setProbModalChest(chest.id)}>
                  查看機率
                </button>
                <button
                  type="button"
                  style={styles.primaryBtn}
                  disabled={isDrawing || loadingPity}
                  onClick={() => drawGacha(chest.id)}
                >
                  {isDrawing ? "抽獎中..." : "點擊抽獎"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={Boolean(probModalChest)}
        title={probModalChest ? `${CHESTS[probModalChest].name} 機率表` : "機率表"}
        onClose={() => setProbModalChest(null)}
      >
        {probModalChest && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>等級</th>
                <th style={styles.th}>點數</th>
                <th style={styles.th}>機率</th>
              </tr>
            </thead>
            <tbody>
              {CHESTS[probModalChest].pool.map((item) => (
                <tr key={item.rank}>
                  <td style={styles.td}>{item.rank}</td>
                  <td style={styles.td}>{item.points}</td>
                  <td style={styles.td}>{(item.rate * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>

      <Modal
        open={resultModal.open}
        title={resultModal.chestId ? `${CHESTS[resultModal.chestId].name} 抽獎結果` : "抽獎結果"}
        onClose={() => setResultModal({ open: false, chestId: null, reward: null, guaranteed: false })}
      >
        {resultModal.reward && (
          <div style={styles.resultWrap}>
            <div style={styles.resultRank}>{resultModal.reward.rank}</div>
            <div style={styles.resultPoints}>獲得 {resultModal.reward.points} 點</div>
            {resultModal.guaranteed && <div style={styles.guaranteeTag}>保底觸發</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 980,
    margin: "0 auto",
    padding: 20,
    color: "#2f1f11",
    fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', sans-serif",
  },
  title: {
    margin: "0 0 8px",
  },
  subtitle: {
    margin: "0 0 16px",
    opacity: 0.8,
  },
  info: {
    margin: "0 0 10px",
    color: "#6a3f18",
  },
  error: {
    margin: "0 0 10px",
    color: "#a62900",
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  card: {
    border: "1px solid #d6b98a",
    borderRadius: 12,
    padding: 14,
    background: "#fff6e7",
  },
  cardTitle: {
    margin: "0 0 8px",
  },
  cost: {
    margin: "0 0 4px",
  },
  pity: {
    margin: "0 0 12px",
    color: "#7f4f20",
    fontSize: 14,
  },
  btnRow: {
    display: "flex",
    gap: 8,
  },
  primaryBtn: {
    border: 0,
    borderRadius: 8,
    padding: "8px 12px",
    background: "#dc7f2b",
    color: "white",
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid #b98b5f",
    borderRadius: 8,
    padding: "8px 12px",
    background: "white",
    color: "#6a3f18",
    cursor: "pointer",
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    display: "grid",
    placeItems: "center",
    zIndex: 999,
  },
  modal: {
    width: "min(92vw, 560px)",
    maxHeight: "80vh",
    overflow: "auto",
    background: "#fffdf8",
    borderRadius: 12,
    border: "1px solid #ddc4a0",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    borderBottom: "1px solid #efdfca",
  },
  modalTitle: {
    margin: 0,
    fontSize: 18,
  },
  iconBtn: {
    border: "1px solid #cba67c",
    background: "white",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
  },
  modalBody: {
    padding: 14,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    borderBottom: "1px solid #e8d5bc",
    padding: "8px 6px",
  },
  td: {
    borderBottom: "1px solid #f1e5d3",
    padding: "8px 6px",
  },
  resultWrap: {
    display: "grid",
    justifyItems: "center",
    gap: 8,
    padding: "12px 0",
  },
  resultRank: {
    fontSize: 36,
    fontWeight: 800,
    color: "#be5b00",
  },
  resultPoints: {
    fontSize: 22,
    fontWeight: 700,
  },
  guaranteeTag: {
    borderRadius: 999,
    padding: "4px 10px",
    background: "#ffe2a8",
    color: "#7a4200",
    fontWeight: 700,
  },
};
