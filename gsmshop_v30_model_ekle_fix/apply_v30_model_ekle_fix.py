#!/usr/bin/env python3
from pathlib import Path

project = Path("/Users/ahmetshen/Documents/gsmshop-web")
app_path = project / "src" / "App.jsx"

if not app_path.exists():
    raise FileNotFoundError("src/App.jsx bulunamadı")

text = app_path.read_text(encoding="utf-8")
backup = project / "src" / "App.before_v30_model_ekle_fix.jsx"
backup.write_text(text, encoding="utf-8")

helper = """
const getModelOptions = (deviceType, brand, phoneModels = {}) => {
  const isPhone = (deviceType || "Telefon") === "Telefon";
  const baseModels = isPhone ? (phoneModels[brand] || []) : [];
  const cleanModels = baseModels.filter((model) => model && model !== "Model Ekle");
  return ["Model Ekle", ...cleanModels];
};
"""

if "const getModelOptions = (deviceType, brand, phoneModels = {})" not in text:
    marker = "const sortSalesForList = (items) =>"
    idx = text.find(marker)
    if idx != -1:
        text = text[:idx] + helper + "\n" + text[idx:]
    else:
        text = helper + "\n" + text

replacements = [
    (
        '{((stockForm.deviceType || "Telefon") === "Telefon" ? (phoneModels[stockForm.brand] || []) : ["Model Ekle"]).map((model) => (',
        '{getModelOptions(stockForm.deviceType, stockForm.brand, phoneModels).map((model) => ('
    ),
    (
        '{(phoneModels[stockForm.brand] || []).map((model) => (',
        '{getModelOptions(stockForm.deviceType, stockForm.brand, phoneModels).map((model) => ('
    ),
    (
        '{phoneModels[stockForm.brand]?.map((model) => (',
        '{getModelOptions(stockForm.deviceType, stockForm.brand, phoneModels).map((model) => ('
    ),
    (
        '{(phoneModels[stockForm.brand] || ["Model Ekle"]).map((model) => (',
        '{getModelOptions(stockForm.deviceType, stockForm.brand, phoneModels).map((model) => ('
    ),
]

for old, new in replacements:
    text = text.replace(old, new)

# Model select içinde sadece statik option varsa Model Ekle'yi ekle.
text = text.replace(
    '<option value="">Model seç</option>',
    '<option value="">Model seç</option>\n                    <option value="Model Ekle">Model Ekle</option>'
)

# Çift eklenmeyi temizle.
while '<option value="Model Ekle">Model Ekle</option>\n                    <option value="Model Ekle">Model Ekle</option>' in text:
    text = text.replace(
        '<option value="Model Ekle">Model Ekle</option>\n                    <option value="Model Ekle">Model Ekle</option>',
        '<option value="Model Ekle">Model Ekle</option>'
    )

text = text.replace('placeholder="Model"', 'placeholder="Model yaz / ekle"')
text = text.replace('placeholder="Model seç"', 'placeholder="Model Ekle / Model seç"')

app_path.write_text(text, encoding="utf-8")

print("GSMSHOP V30 Model Ekle düzeltmesi uygulandı.")
print("Yedek: src/App.before_v30_model_ekle_fix.jsx")
print("Telefon seçildiğinde de model listesinde Model Ekle görünecek.")
