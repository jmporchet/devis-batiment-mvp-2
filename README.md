# Devis chantier

MVP d'un générateur de devis pour une PME suisse du bâtiment. Le chef de chantier prend jusqu'à 3 photos et dicte environ 30 secondes de notes. L'application propose un devis structuré à partir de la grille de prix de l'entreprise, en CHF avec TVA à 8,1 %, puis produit un PDF à l'en-tête de l'entreprise.

## Lancer en local

Prérequis : Node 22 ou plus récent.

```bash
npm install
npm run dev        # développement, http://localhost:3000
# ou
npm run build && npm start   # serveur local de production
```

Pour tester sur un téléphone du même réseau Wi-Fi : `npm run dev -- -H 0.0.0.0`, puis ouvrir `http://<ip-de-la-machine>:3000`.

La base SQLite est créée automatiquement dans `data/devis.sqlite` au premier accès (chemin modifiable via `DATABASE_PATH`). Les migrations s'appliquent au démarrage.

## Vérifications

```bash
npm run check      # lint + types + tests
```

## Documentation

Le plan du MVP et les choix techniques sont dans [docs/PLAN.md](docs/PLAN.md).
