# Coloca aquí `health_classifier.pt` (no versionado).

```powershell
cd plant-detection
.\.venv\Scripts\activate
$env:PYTHONPATH="."
# Preferido (Kaggle):
python scripts/train_health.py --epochs 10 --max-per-class 200
# Sin Kaggle (bootstrap local):
python scripts/train_bootstrap.py --epochs 3
```
