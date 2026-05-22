import { useState, useRef, useCallback } from "react";

const systemPrompt = `Tu es un expert en nutrition. Quand on te donne une photo d'un repas ou une description, tu dois estimer les calories et macronutriments.

Réponds UNIQUEMENT en JSON valide, sans backticks ni markdown, avec ce format exact :
{
  "aliments": ["aliment 1", "aliment 2"],
  "calories": 450,
  "proteines": 30,
  "glucides": 45,
  "lipides": 12,
  "description": "Une courte description du repas analysé"
}

Sois réaliste dans tes estimations. Si tu ne peux pas analyser, retourne calories: 0.`;

const PRODUITS_DEMO = [
  { barcode: "3017620422003", nom: "Nutella", calories: 530, proteines: 6, glucides: 57, lipides: 31, image: "🍫" },
  { barcode: "5449000000439", nom: "Coca-Cola Classic", calories: 42, proteines: 0, glucides: 11, lipides: 0, image: "🥤" },
  { barcode: "3175680011534", nom: "Danone Activia Nature", calories: 66, proteines: 4, glucides: 8, lipides: 2, image: "🥛" },
  { barcode: "7613035898226", nom: "KitKat Original", calories: 518, proteines: 7, glucides: 60, lipides: 27, image: "🍬" },
  { barcode: "3560070976478", nom: "Pain de mie Harry's", calories: 270, proteines: 8, glucides: 48, lipides: 4, image: "🍞" },
  { barcode: "3155251205306", nom: "Président Beurre Doux", calories: 740, proteines: 1, glucides: 0, lipides: 82, image: "🧈" },
  { barcode: "3270190079594", nom: "Bjorg Lait d'Amande", calories: 24, proteines: 0, glucides: 3, lipides: 1, image: "🥜" },
  { barcode: "3274080005003", nom: "Evian Eau Minérale", calories: 0, proteines: 0, glucides: 0, lipides: 0, image: "💧" },
  { barcode: "3068320058016", nom: "Philadelphia Nature", calories: 232, proteines: 5, glucides: 4, lipides: 22, image: "🧀" },
  { barcode: "8000500037560", nom: "Ferrero Rocher", calories: 596, proteines: 8, glucides: 50, lipides: 40, image: "🍬" },
];

const C = {
  bordeaux: "#54110f", bordeauxLight: "#7a1f1c",
  cashmere: "#f39fa9", cashmereLight: "#fbd5da",
  chocolat: "#30160f", creme: "#f7e4d7", cremeDark: "#edddd0",
};

const ACTIVITE = [
  { val: 1.2, label: "Sédentaire", desc: "Peu ou pas d'exercice" },
  { val: 1.375, label: "Légèrement actif", desc: "1-3 fois/semaine" },
  { val: 1.55, label: "Modérément actif", desc: "3-5 fois/semaine" },
  { val: 1.725, label: "Très actif", desc: "6-7 fois/semaine" },
  { val: 1.9, label: "Extrêmement actif", desc: "Sport intense quotidien" },
];

const OBJECTIFS = [
  { val: -500, label: "Perdre du poids", emoji: "📉", desc: "Déficit de 500 kcal/jour" },
  { val: -250, label: "Perte douce", emoji: "🌸", desc: "Déficit de 250 kcal/jour" },
  { val: 0, label: "Maintenir", emoji: "⚖️", desc: "Conserver mon poids actuel" },
  { val: 250, label: "Prendre de la masse", emoji: "💪", desc: "Surplus de 250 kcal/jour" },
];

function calculerProfil(prenom, age, poids, taille, activite, objectif) {
  // Mifflin-St Jeor pour femme
  const bmr = Math.round(10 * poids + 6.25 * taille - 5 * age - 161);
  const tdee = Math.round(bmr * activite);
  const cibles = Math.max(1200, Math.round(tdee + objectif));

  // Répartition macros adaptée à l'objectif
  let pctProt, pctLip, pctGluc;
  if (objectif <= -500) {
    // Perte de poids — plus de protéines pour préserver le muscle
    pctProt = 0.35; pctLip = 0.35; pctGluc = 0.30;
  } else if (objectif === -250) {
    // Perte douce
    pctProt = 0.30; pctLip = 0.32; pctGluc = 0.38;
  } else if (objectif === 0) {
    // Maintien — équilibré
    pctProt = 0.28; pctLip = 0.30; pctGluc = 0.42;
  } else {
    // Prise de masse — plus de glucides pour l'énergie
    pctProt = 0.28; pctLip = 0.25; pctGluc = 0.47;
  }

  // Protéines : minimum recommandé 1.6g/kg pour perte, 1.4g/kg maintien, 2g/kg masse
  const protMin = objectif <= -250 ? poids * 1.6 : objectif === 0 ? poids * 1.4 : poids * 2.0;
  const proteines = Math.max(Math.round(protMin), Math.round((cibles * pctProt) / 4));
  const lipides = Math.round((cibles * pctLip) / 9);
  const glucides = Math.max(50, Math.round((cibles - proteines * 4 - lipides * 9) / 4));

  return { prenom, age, poids, taille, activite, objectif, bmr, tdee, cibles, proteines, lipides, glucides };
}

function ajouterRepas(setJournal, data) {
  setJournal(j => [...j, {
    ...data,
    heure: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    id: Date.now()
  }]);
}

function Input({ label, value, onChange, type = "number", placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: "#9a7a75", letterSpacing: 2, marginBottom: 6, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase" }}>{label}</div>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width: "100%", background: "#fdf8f7", border: `1px solid ${C.cremeDark}`, borderRadius: 12, padding: "13px 14px", color: C.chocolat, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
    </div>
  );
}

// ---- ONBOARDING ----
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [prenom, setPrenom] = useState("");
  const [age, setAge] = useState("");
  const [poids, setPoids] = useState("");
  const [taille, setTaille] = useState("");
  const [activite, setActivite] = useState(null);
  const [objectif, setObjectif] = useState(null);

  const canNext = [
    prenom.trim().length > 0,
    age > 0 && poids > 0 && taille > 0,
    activite !== null,
    objectif !== null,
  ][step];

  const handleDone = () => {
    const profil = calculerProfil(prenom, Number(age), Number(poids), Number(taille), activite, objectif);
    onDone(profil);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.creme, fontFamily: "'Georgia', serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ background: C.bordeaux, padding: "28px 20px 22px", textAlign: "center" }}>
        <div style={{ fontSize: 10, letterSpacing: 5, color: C.cashmere, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Bienvenue</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, margin: 0, fontWeight: 700, color: C.creme, letterSpacing: 3 }}>REBORN</h1>
        <div style={{ fontSize: 11, color: C.cashmereLight, marginTop: 4, fontFamily: "'DM Sans', sans-serif", letterSpacing: 2 }}>NUTRITION · CONSCIENCE · TRANSFORMATION</div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 100, background: i <= step ? C.bordeaux : C.cremeDark, transition: "background 0.3s" }} />
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(84,17,15,0.08)", border: `1px solid ${C.cremeDark}` }}>

          {step === 0 && (
            <div>
              <div style={{ fontSize: 22, fontFamily: "'Cormorant Garamond', serif", color: C.bordeaux, fontWeight: 700, marginBottom: 8 }}>Comment tu t'appelles ? 👋</div>
              <div style={{ fontSize: 13, color: "#9a7a75", marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }}>Ton outil sera personnalisé rien que pour toi.</div>
              <Input label="Prénom" value={prenom} onChange={e => setPrenom(e.target.value)} type="text" placeholder="Ex : Sophie" />
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={{ fontSize: 22, fontFamily: "'Cormorant Garamond', serif", color: C.bordeaux, fontWeight: 700, marginBottom: 8 }}>Tes mensurations 📏</div>
              <div style={{ fontSize: 13, color: "#9a7a75", marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }}>Pour calculer ton métabolisme de base précisément.</div>
              <Input label="Âge (ans)" value={age} onChange={e => setAge(e.target.value)} placeholder="Ex : 32" />
              <Input label="Poids (kg)" value={poids} onChange={e => setPoids(e.target.value)} placeholder="Ex : 65" />
              <Input label="Taille (cm)" value={taille} onChange={e => setTaille(e.target.value)} placeholder="Ex : 165" />
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontSize: 22, fontFamily: "'Cormorant Garamond', serif", color: C.bordeaux, fontWeight: 700, marginBottom: 8 }}>Ton niveau d'activité 🏃‍♀️</div>
              <div style={{ fontSize: 13, color: "#9a7a75", marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>Sois honnête — c'est pour ton bien !</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ACTIVITE.map(a => (
                  <div key={a.val} onClick={() => setActivite(a.val)}
                    style={{ padding: "14px 16px", borderRadius: 14, border: `2px solid ${activite === a.val ? C.bordeaux : C.cremeDark}`, background: activite === a.val ? "#fdf0ef" : "#fdf8f7", cursor: "pointer", transition: "all 0.2s" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: activite === a.val ? C.bordeaux : C.chocolat, fontFamily: "inherit" }}>{a.label}</div>
                    <div style={{ fontSize: 12, color: "#9a7a75", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{a.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ fontSize: 22, fontFamily: "'Cormorant Garamond', serif", color: C.bordeaux, fontWeight: 700, marginBottom: 8 }}>Ton objectif 🎯</div>
              <div style={{ fontSize: 13, color: "#9a7a75", marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>Qu'est-ce que tu veux accomplir ?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {OBJECTIFS.map(o => (
                  <div key={o.val} onClick={() => setObjectif(o.val)}
                    style={{ padding: "14px 16px", borderRadius: 14, border: `2px solid ${objectif === o.val ? C.bordeaux : C.cremeDark}`, background: objectif === o.val ? "#fdf0ef" : "#fdf8f7", cursor: "pointer", transition: "all 0.2s" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: objectif === o.val ? C.bordeaux : C.chocolat, fontFamily: "inherit" }}>{o.emoji} {o.label}</div>
                    <div style={{ fontSize: 12, color: "#9a7a75", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: 14, borderRadius: 14, border: `1px solid ${C.cremeDark}`, background: "transparent", color: "#9a7a75", cursor: "pointer", fontWeight: 600, fontSize: 15, fontFamily: "inherit" }}>← Retour</button>
            )}
            <button onClick={step < 3 ? () => setStep(s => s + 1) : handleDone} disabled={!canNext}
              style={{ flex: 2, padding: 14, borderRadius: 14, border: "none", background: canNext ? C.bordeaux : C.cremeDark, color: canNext ? C.creme : "#9a7a75", cursor: canNext ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 15, fontFamily: "inherit", transition: "all 0.2s" }}>
              {step < 3 ? "Continuer →" : "✨ Calculer mon profil"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- RÉSULTATS PROFIL ----
function ResultatProfil({ profil, onContinue }) {
  return (
    <div style={{ minHeight: "100vh", background: C.creme, fontFamily: "'Georgia', serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ background: C.bordeaux, padding: "28px 20px 22px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, margin: 0, fontWeight: 700, color: C.creme, letterSpacing: 3 }}>REBORN</h1>
      </div>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(84,17,15,0.08)", border: `1px solid ${C.cremeDark}`, marginBottom: 16 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🌸</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 700, color: C.bordeaux }}>Ton profil, {profil.prenom} !</div>
            <div style={{ fontSize: 13, color: "#9a7a75", marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>Voici tes objectifs personnalisés</div>
          </div>

          <div style={{ background: "#fdf0ef", borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${C.cashmere}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Métabolisme de base", val: `${profil.bmr} kcal`, desc: "Au repos complet" },
                { label: "Dépense totale", val: `${profil.tdee} kcal`, desc: "Avec ton activité" },
              ].map(m => (
                <div key={m.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.bordeaux, fontFamily: "'Cormorant Garamond', serif" }}>{m.val}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.chocolat, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: "#9a7a75", fontFamily: "'DM Sans', sans-serif" }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: C.bordeaux, borderRadius: 16, padding: 16, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.cashmere, letterSpacing: 2, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>TON OBJECTIF CALORIQUE</div>
            <div style={{ fontSize: 42, fontWeight: 700, color: C.creme, fontFamily: "'Cormorant Garamond', serif" }}>{profil.cibles}</div>
            <div style={{ fontSize: 13, color: C.cashmereLight, fontFamily: "'DM Sans', sans-serif" }}>kcal par jour</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Protéines", val: profil.proteines, color: C.bordeaux, bg: "#fdf0ef", note: "Muscle & satiété" },
              { label: "Glucides", val: profil.glucides, color: "#7a4f3a", bg: "#fdf5f0", note: "Énergie" },
              { label: "Lipides", val: profil.lipides, color: "#9a3030", bg: "#fef0f0", note: "Hormones" },
            ].map(m => (
              <div key={m.label} style={{ background: m.bg, borderRadius: 12, padding: "12px 8px", textAlign: "center", border: `1px solid ${C.cremeDark}` }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: m.color, fontFamily: "'Cormorant Garamond', serif" }}>{m.val}g</div>
                <div style={{ fontSize: 10, color: m.color, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", letterSpacing: 1 }}>{m.label.toUpperCase()}</div>
                <div style={{ fontSize: 9, color: "#9a7a75", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{m.note}</div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onContinue} style={{ width: "100%", padding: 16, borderRadius: 16, border: "none", background: C.bordeaux, color: C.creme, cursor: "pointer", fontWeight: 700, fontSize: 16, fontFamily: "inherit" }}>
          Commencer mon journal →
        </button>
      </div>
    </div>
  );
}

// ---- APP PRINCIPALE ----
export default function RebornApp() {
  const [screen, setScreen] = useState("onboarding"); // onboarding | resultats | journal
  const [profil, setProfil] = useState(null);
  const [journal, setJournal] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [texte, setTexte] = useState("");
  const [mode, setMode] = useState("photo");
  const [scanResult, setScanResult] = useState(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [quantite, setQuantite] = useState(100);
  const [scanInput, setScanInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const fileRef = useRef();

  const handleProfil = (p) => { setProfil(p); setScreen("resultats"); };
  const handleContinue = () => setScreen("journal");

  const totalCalories = journal.reduce((s, r) => s + r.calories, 0);
  const totalProteines = journal.reduce((s, r) => s + r.proteines, 0);
  const totalGlucides = journal.reduce((s, r) => s + r.glucides, 0);
  const totalLipides = journal.reduce((s, r) => s + r.lipides, 0);
  const objectifCal = profil?.cibles || 1800;
  const objectifProt = profil?.proteines || 120;
  const objectifGluc = profil?.glucides || 180;
  const objectifLip = profil?.lipides || 55;
  const progression = Math.min((totalCalories / objectifCal) * 100, 100);
  const restant = Math.max(objectifCal - totalCalories, 0);
  const couleurBarre = progression >= 100 ? C.bordeaux : progression >= 80 ? C.bordeauxLight : C.cashmere;

  const rechercherProduit = (barcode) => {
    setError(null); setScanResult(null);
    const p = PRODUITS_DEMO.find(p => p.barcode === barcode.trim());
    if (p) { setScanResult(p); setQuantite(100); }
    else setError("Produit non trouvé. Essaie : Nutella, Coca-Cola...");
  };

  const handleScanInput = (val) => {
    setScanInput(val); setManualBarcode(val);
    setSuggestions(val.length >= 2 ? PRODUITS_DEMO.filter(p => p.nom.toLowerCase().includes(val.toLowerCase()) || p.barcode.includes(val)) : []);
  };

  const confirmerProduit = (p, qte = 100) => {
    const r = qte / 100;
    ajouterRepas(setJournal, { aliments: [p.nom], calories: Math.round(p.calories * r), proteines: Math.round(p.proteines * r), glucides: Math.round(p.glucides * r), lipides: Math.round(p.lipides * r), description: `${p.image} ${p.nom} (${qte}g)` });
    setScanResult(null); setScanInput(""); setManualBarcode(""); setSuggestions([]);
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { setPreview(e.target.result); setImageData(e.target.result.split(",")[1]); };
    reader.readAsDataURL(file);
  };

  const analyserPhoto = useCallback(async () => {
    if (!imageData) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: systemPrompt, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageData } }, { type: "text", text: "Analyse ce repas." }] }] }) });
      const data = await res.json();
      const parsed = JSON.parse(data.content?.find(b => b.type === "text")?.text?.replace(/```json|```/g, "").trim() || "{}");
      if (parsed.calories > 0) { ajouterRepas(setJournal, parsed); setPreview(null); setImageData(null); }
      else setError("Impossible d'analyser.");
    } catch { setError("Erreur. Réessaie."); }
    setLoading(false);
  }, [imageData]);

  const analyserTexte = useCallback(async () => {
    if (!texte.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: systemPrompt, messages: [{ role: "user", content: `Estime les calories et macros pour : ${texte}` }] }) });
      const data = await res.json();
      const parsed = JSON.parse(data.content?.find(b => b.type === "text")?.text?.replace(/```json|```/g, "").trim() || "{}");
      if (parsed.calories > 0) { ajouterRepas(setJournal, parsed); setTexte(""); }
      else setError("Impossible d'estimer.");
    } catch { setError("Erreur. Réessaie."); }
    setLoading(false);
  }, [texte]);

  const supprimer = (id) => setJournal(j => j.filter(r => r.id !== id));
  const btn = (active, onClick, label) => (
    <button onClick={onClick} style={{ flex: 1, padding: "11px 4px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit", background: active ? C.bordeaux : C.cremeDark, color: active ? C.creme : C.bordeaux }}>
      {label}
    </button>
  );

  if (screen === "onboarding") return <Onboarding onDone={handleProfil} />;
  if (screen === "resultats") return <ResultatProfil profil={profil} onContinue={handleContinue} />;

  return (
    <div style={{ minHeight: "100vh", background: C.creme, fontFamily: "'Georgia', serif", color: C.chocolat, padding: "0 0 80px 0" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      <div style={{ background: C.bordeaux, padding: "20px 20px 16px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, margin: 0, fontWeight: 700, color: C.creme, letterSpacing: 3 }}>REBORN</h1>
        <div style={{ fontSize: 11, color: C.cashmere, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>Bonjour {profil?.prenom} 🌸</div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>

        {/* Dashboard */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px", margin: "16px 0", border: `1px solid ${C.cremeDark}`, boxShadow: "0 4px 20px rgba(84,17,15,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: "#9a7a75", marginBottom: 3, fontFamily: "'DM Sans', sans-serif", letterSpacing: 1 }}>CALORIES AUJOURD'HUI</div>
              <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color: couleurBarre, fontFamily: "'Cormorant Garamond', serif" }}>
                {totalCalories}<span style={{ fontSize: 14, color: "#9a7a75", fontWeight: 400, marginLeft: 3, fontFamily: "'DM Sans', sans-serif" }}>/ {objectifCal} kcal</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <button onClick={() => setScreen("resultats")} style={{ background: "#fdf0ef", border: `1px solid ${C.cashmere}`, borderRadius: 10, padding: "8px 12px", color: C.bordeaux, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 }}>
                Mon profil 👤
              </button>
              <div style={{ fontSize: 11, color: "#9a7a75", marginTop: 5, fontFamily: "'DM Sans', sans-serif" }}>{restant} kcal restantes</div>
            </div>
          </div>

          <div style={{ background: C.cremeDark, borderRadius: 100, height: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progression}%`, background: `linear-gradient(90deg, ${C.cashmere}, ${C.bordeaux})`, borderRadius: 100, transition: "width 0.6s ease" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
            {[
              { label: "Protéines", val: totalProteines, obj: objectifProt, color: C.bordeaux, bg: "#fdf0ef" },
              { label: "Glucides", val: totalGlucides, obj: objectifGluc, color: "#7a4f3a", bg: "#fdf5f0" },
              { label: "Lipides", val: totalLipides, obj: objectifLip, color: "#9a3030", bg: "#fef0f0" },
            ].map(m => (
              <div key={m.label} style={{ background: m.bg, borderRadius: 12, padding: "10px 8px", textAlign: "center", border: `1px solid ${C.cremeDark}` }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: m.color, fontFamily: "'Cormorant Garamond', serif" }}>{m.val}g</div>
                <div style={{ fontSize: 9, color: "#9a7a75", fontFamily: "'DM Sans', sans-serif" }}>/ {m.obj}g</div>
                <div style={{ fontSize: 9, color: "#9a7a75", fontFamily: "'DM Sans', sans-serif", letterSpacing: 1, marginTop: 1 }}>{m.label.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Onglets */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {btn(mode === "photo", () => { setMode("photo"); setError(null); setScanResult(null); }, "📸 Photo")}
          {btn(mode === "scan", () => { setMode("scan"); setError(null); setScanResult(null); }, "📦 Scanner")}
          {btn(mode === "texte", () => { setMode("texte"); setError(null); }, "✍️ Texte")}
        </div>

        {/* Zone */}
        <div style={{ background: "#fff", borderRadius: 20, padding: 18, border: `1px solid ${C.cremeDark}`, marginBottom: 18, boxShadow: "0 4px 20px rgba(84,17,15,0.06)" }}>

          {mode === "photo" && (
            <>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
              {!preview ? (
                <div onClick={() => fileRef.current.click()}
                  style={{ border: `2px dashed ${C.cashmere}`, borderRadius: 14, padding: "36px 20px", textAlign: "center", cursor: "pointer", background: "#fdf8f7" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.bordeaux}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.cashmere}>
                  <div style={{ fontSize: 44, marginBottom: 10 }}>📸</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.bordeaux, marginBottom: 5, fontFamily: "'Cormorant Garamond', serif" }}>Prends ton repas en photo</div>
                  <div style={{ fontSize: 12, color: "#9a7a75", fontFamily: "'DM Sans', sans-serif" }}>Ou importe depuis ta galerie</div>
                </div>
              ) : (
                <div>
                  <img src={preview} alt="repas" style={{ width: "100%", borderRadius: 12, maxHeight: 240, objectFit: "cover" }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => { setPreview(null); setImageData(null); }} style={{ flex: 1, padding: 11, borderRadius: 12, border: `1px solid ${C.cremeDark}`, background: "transparent", color: "#9a7a75", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Annuler</button>
                    <button onClick={analyserPhoto} disabled={loading} style={{ flex: 2, padding: 11, borderRadius: 12, border: "none", background: loading ? "#c9a09e" : C.bordeaux, color: C.creme, cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>
                      {loading ? "Analyse..." : "✨ Analyser"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {mode === "scan" && (
            <div>
              <div style={{ background: "#fdf5f0", border: `1px solid ${C.cashmere}`, borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontSize: 11, color: C.bordeaux, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
                ⚡ Mode démo — recherche par nom ou code-barres
              </div>
              {!scanResult ? (
                <div>
                  <div style={{ position: "relative" }}>
                    <input value={scanInput} onChange={e => handleScanInput(e.target.value)} placeholder="Recherche : Nutella, Coca..."
                      style={{ width: "100%", background: "#fdf8f7", border: `1px solid ${C.cremeDark}`, borderRadius: 12, padding: "12px 14px", color: C.chocolat, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                    {suggestions.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: `1px solid ${C.cremeDark}`, borderRadius: 12, marginTop: 4, overflow: "hidden", zIndex: 10, boxShadow: "0 8px 24px rgba(84,17,15,0.1)" }}>
                        {suggestions.map(p => (
                          <div key={p.barcode} onClick={() => { setScanResult(p); setQuantite(100); setScanInput(p.nom); setSuggestions([]); }}
                            style={{ padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${C.cremeDark}` }}
                            onMouseEnter={e => e.currentTarget.style.background = "#fdf5f0"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <span style={{ fontSize: 20 }}>{p.image}</span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.chocolat, fontFamily: "inherit" }}>{p.nom}</div>
                              <div style={{ fontSize: 11, color: "#9a7a75", fontFamily: "'DM Sans', sans-serif" }}>{p.calories} kcal / 100g</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "center", color: "#9a7a75", fontSize: 11, margin: "12px 0", fontFamily: "'DM Sans', sans-serif" }}>— ou code-barres manuel —</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={manualBarcode} onChange={e => setManualBarcode(e.target.value)} placeholder="Ex : 3017620422003"
                      style={{ flex: 1, background: "#fdf8f7", border: `1px solid ${C.cremeDark}`, borderRadius: 12, padding: "11px 14px", color: C.chocolat, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                    <button onClick={() => rechercherProduit(manualBarcode)} disabled={!manualBarcode.trim()}
                      style={{ padding: "11px 14px", borderRadius: 12, border: "none", background: manualBarcode.trim() ? C.bordeaux : C.cremeDark, color: manualBarcode.trim() ? C.creme : "#9a7a75", cursor: manualBarcode.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>🔍</button>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 10, color: "#9a7a75", marginBottom: 8, letterSpacing: 2, fontFamily: "'DM Sans', sans-serif" }}>PRODUITS DÉMO</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {PRODUITS_DEMO.map(p => (
                        <button key={p.barcode} onClick={() => { setScanResult(p); setQuantite(100); }}
                          style={{ padding: "6px 11px", borderRadius: 20, border: `1px solid ${C.cremeDark}`, background: "#fdf8f7", color: C.chocolat, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                          {p.image} {p.nom}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ background: "#fdf5f0", border: `1px solid ${C.cashmere}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 36 }}>{scanResult.image}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: C.bordeaux, fontFamily: "'Cormorant Garamond', serif" }}>{scanResult.nom}</div>
                        <div style={{ fontSize: 11, color: "#9a7a75", fontFamily: "'DM Sans', sans-serif" }}>Pour 100g</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                      {[{ l: "Cal", v: scanResult.calories, u: "kcal", c: C.bordeaux }, { l: "Prot", v: scanResult.proteines, u: "g", c: "#7a4f3a" }, { l: "Gluc", v: scanResult.glucides, u: "g", c: "#9a6030" }, { l: "Lip", v: scanResult.lipides, u: "g", c: "#9a3030" }].map(m => (
                        <div key={m.l} style={{ background: "#fff", borderRadius: 8, padding: "7px 4px", textAlign: "center", border: `1px solid ${C.cremeDark}` }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: m.c, fontFamily: "'Cormorant Garamond', serif" }}>{m.v}<span style={{ fontSize: 8 }}>{m.u}</span></div>
                          <div style={{ fontSize: 9, color: "#9a7a75", fontFamily: "'DM Sans', sans-serif" }}>{m.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: "#9a7a75", marginBottom: 7, fontFamily: "'DM Sans', sans-serif", letterSpacing: 1 }}>QUANTITÉ (G)</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      {[50, 100, 150, 200].map(q => (
                        <button key={q} onClick={() => setQuantite(q)} style={{ flex: 1, padding: "9px 4px", borderRadius: 10, border: `1px solid ${quantite === q ? C.bordeaux : C.cremeDark}`, background: quantite === q ? "#fdf0ef" : "transparent", color: quantite === q ? C.bordeaux : "#9a7a75", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit" }}>
                          {q}g
                        </button>
                      ))}
                    </div>
                    <input type="number" value={quantite} onChange={e => setQuantite(Number(e.target.value))}
                      style={{ width: "100%", background: "#fdf8f7", border: `1px solid ${C.cremeDark}`, borderRadius: 10, padding: "9px 12px", color: C.chocolat, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                    <div style={{ marginTop: 6, fontSize: 13, color: C.bordeaux, fontWeight: 700, fontFamily: "'Cormorant Garamond', serif" }}>
                      → {Math.round(scanResult.calories * quantite / 100)} kcal pour {quantite}g
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setScanResult(null); setScanInput(""); }} style={{ flex: 1, padding: 11, borderRadius: 12, border: `1px solid ${C.cremeDark}`, background: "transparent", color: "#9a7a75", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>← Retour</button>
                    <button onClick={() => confirmerProduit(scanResult, quantite)} style={{ flex: 2, padding: 11, borderRadius: 12, border: "none", background: C.bordeaux, color: C.creme, cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>
                      ✅ Ajouter au journal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === "texte" && (
            <>
              <textarea value={texte} onChange={e => setTexte(e.target.value)} placeholder="Ex : 2 œufs brouillés, une tranche de pain complet..." rows={4}
                style={{ width: "100%", background: "#fdf8f7", border: `1px solid ${C.cremeDark}`, borderRadius: 14, padding: 13, color: C.chocolat, fontSize: 14, resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.6, fontFamily: "inherit" }} />
              <button onClick={analyserTexte} disabled={loading || !texte.trim()} style={{ width: "100%", marginTop: 10, padding: 13, borderRadius: 14, border: "none", background: loading || !texte.trim() ? C.cremeDark : C.bordeaux, color: loading || !texte.trim() ? "#9a7a75" : C.creme, cursor: loading || !texte.trim() ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>
                {loading ? "Analyse en cours..." : "✨ Estimer les calories"}
              </button>
            </>
          )}

          {error && <div style={{ marginTop: 10, padding: "10px 14px", background: "#fdf0ef", border: `1px solid ${C.cashmere}`, borderRadius: 10, color: C.bordeaux, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>{error}</div>}
        </div>

        {/* Journal */}
        {journal.length > 0 && (
          <div>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#9a7a75", textTransform: "uppercase", marginBottom: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Repas enregistrés</div>
            {[...journal].reverse().map(repas => (
              <div key={repas.id} style={{ background: "#fff", borderRadius: 14, padding: "14px", marginBottom: 8, border: `1px solid ${C.cremeDark}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.chocolat, fontFamily: "'Cormorant Garamond', serif" }}>{repas.description}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.bordeaux, fontFamily: "'Cormorant Garamond', serif" }}>{repas.calories}<span style={{ fontSize: 10, color: "#9a7a75", marginLeft: 2 }}>kcal</span></div>
                  </div>
                  <div style={{ fontSize: 11, color: "#9a7a75", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{repas.heure} · {repas.aliments?.join(", ")}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[{ l: "P", v: repas.proteines, c: C.bordeaux }, { l: "G", v: repas.glucides, c: "#7a4f3a" }, { l: "L", v: repas.lipides, c: "#9a3030" }].map(m => (
                      <span key={m.l} style={{ fontSize: 10, background: "#fdf5f0", color: m.c, padding: "2px 7px", borderRadius: 100, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{m.l} {m.v}g</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => supprimer(repas.id)} style={{ background: "#fdf0ef", border: "none", borderRadius: 8, padding: "5px 7px", cursor: "pointer", color: C.bordeaux, fontSize: 13, flexShrink: 0 }}>✕</button>
              </div>
            ))}
            <button onClick={() => setJournal([])} style={{ width: "100%", marginTop: 6, padding: 11, borderRadius: 12, border: `1px solid ${C.cashmere}`, background: "#fdf0ef", color: C.bordeaux, cursor: "pointer", fontWeight: 600, fontSize: 12, fontFamily: "inherit" }}>
              Réinitialiser le journal
            </button>
          </div>
        )}

        {journal.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px 20px", color: "#9a7a75" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
            <div style={{ fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Ton journal est vide.<br />Ajoute ton premier repas !</div>
          </div>
        )}
      </div>
    </div>
  );
}