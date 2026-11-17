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

## Brouillon IA

Après la capture, l'application envoie la note vocale et les photos à un modèle multimodal via [OpenRouter](https://openrouter.ai). Le modèle transcrit la note et propose des lignes choisies dans la grille, avec des quantités. **Il ne fixe jamais les prix** : ils sont relus dans la grille à partir du code du poste. Un travail absent de la grille arrive « à chiffrer ». La transcription et les points à vérifier vont dans les notes du devis. Tout passe ensuite par la relecture.

Pour l'activer :

```bash
cp .env.example .env.local
# puis renseigner OPENROUTER_API_KEY dans .env.local et redémarrer le serveur
```

Sans clé, l'application fonctionne normalement, sans brouillon IA.

Confidentialité : les demandes sont routées uniquement vers des fournisseurs sans conservation des données (`data_collection: "deny"`, `zdr: true`). Les données quittent tout de même la machine : informez-en les clients.

Coût mesuré : environ 1 à 2 centimes de dollar par devis (note de 25 s), pour une quinzaine de secondes d'attente.

Essai hors application avec vos propres fichiers :

```bash
OPENROUTER_API_KEY=… npm run ai:smoke -- note.webm photo1.jpg
```

## Tester sur téléphone

Le téléphone et l'ordinateur doivent être sur le même réseau Wi-Fi. Les photos et la galerie fonctionnent en HTTP, mais le navigateur ne donne accès au micro (enregistrement de la note vocale) qu'en HTTPS ou sur localhost. Sur `http://192.168.x.x`, l'application affiche un message et propose de joindre un fichier audio à la place.

Pour tester le micro, lancer le serveur de développement en HTTPS :

```bash
npm run dev:https   # https://localhost:3000, écoute aussi sur le réseau local
```

Puis ouvrir `https://<ip-de-la-machine>:3000` sur le téléphone. Le certificat est auto-signé : accepter l'avertissement du navigateur (ou installer le certificat de l'autorité mkcert sur le téléphone pour ne plus le voir). Sans HTTPS, `npm run dev -- -H 0.0.0.0` suffit pour tout le reste.

La base SQLite est créée automatiquement dans `data/devis.sqlite` au premier accès (chemin modifiable via `DATABASE_PATH`). Les migrations s'appliquent au démarrage.

## Vérifications

```bash
npm run check      # lint + types + tests
```

## Documentation

Le plan du MVP et les choix techniques sont dans [docs/PLAN.md](docs/PLAN.md).
