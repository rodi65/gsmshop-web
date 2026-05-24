import { useState } from "react";
import { closeCashDay, createDailyBackup } from "../services/dataService";

export default function CashClosingPanel() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCloseDay() {
    setBusy(true);
    setMessage("");

    try {
      const closingId = await closeCashDay(date, note);
      await createDailyBackup();
      setMessage(`Kasa kapanışı yapıldı ve günlük yedek oluşturuldu. Kapanış ID: ${closingId}`);
    } catch (err) {
      setMessage(err.message || "Kasa kapanışı başarısız.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Kasa Kapanış Raporu</h2>
      <p>Günün satış, nakit, kart, alacak, gider ve kâr toplamını veritabanına kapanış olarak işler.</p>

      <div className="form-grid">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <input placeholder="Kapanış notu" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>

      <button className="primary" onClick={handleCloseDay} disabled={busy}>
        {busy ? "İşleniyor..." : "Kasa Kapanışı Yap + Günlük Yedek Al"}
      </button>

      {message && <div className="system-message">{message}</div>}
    </section>
  );
}
