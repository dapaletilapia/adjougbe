# Guide du Studio Adjougbe

Ce guide explique comment gérer le site au quotidien, sans développeur. Le Studio est l'espace d'administration : **adjougbe.ci/admin**.

---

## 1. Se connecter

1. Allez sur **adjougbe.ci/connexion** et saisissez votre e-mail et votre mot de passe.
2. Le Studio demande ensuite un **code à 6 chiffres**. Il s'affiche dans votre application d'authentification (Google Authenticator, Microsoft Authenticator…).
3. **Première connexion** : scannez le QR code affiché avec l'application. Le Studio vous donne alors **8 codes de secours** : notez-les sur papier et rangez-les. Chacun permet une connexion si vous perdez votre téléphone.

> Si vous perdez à la fois votre téléphone et vos codes de secours, contactez All'Digit pour réinitialiser la double authentification.

---

## 2. Le tableau de bord

Il affiche les ventes du jour et du mois, les nouveaux comptes, ce qui attend votre modération, la répartition des paiements (Orange Money, MTN, Wave…), les dernières commandes, les alertes de lecture suspecte et la prochaine formation.

- Le bouton **Export comptable** télécharge toutes les ventes en fichier Excel.
- Une **alerte de lecture** signale un compte qui lit anormalement vite (signe de copie ou de partage). Vous pouvez consulter son journal de lecture ou le bloquer en un clic.

---

## 3. Les œuvres

### Modifier une œuvre
**Œuvres → Modifier**. Vous pouvez changer le titre, le résumé, la couverture, le prix, la promotion (avec date de fin : un compte à rebours s'affiche sur la fiche) et le mode d'accès :

| Mode | Effet |
|---|---|
| **Payant** | Le lecteur achète, puis lit dans sa bibliothèque. |
| **Gratuit avec formulaire** | Le lecteur répond à un formulaire (à choisir), puis lit. |
| **Gratuit avec compte** | Un compte suffit. |
| **Extrait public** | Lisible par tous, sans compte. |

« Extrait gratuit » fixe le nombre de séries (ou d'histoires) lisibles sans acheter.

### Ajouter le contenu d'un livre
**Œuvres → Modifier → onglet Contenu**, puis glissez votre fichier Word (.docx) dans la zone prévue.
- Le fichier est découpé automatiquement à chaque titre du type « Série 1 », « Série 2 : Titre », « Histoire 3 — Titre ».
- Un **aperçu** montre le découpage avant l'import : vérifiez-le, puis cliquez sur **Importer**.
- Dans le texte, une ligne qui commence par `> ` devient une punchline mise en avant ; `# ` devient un intertitre.

Corriger un texte crée une nouvelle édition : tous les acheteurs voient la correction tout de suite, sans perdre leur progression.

### Les packs
En bas de la page **Œuvres** : **Gérer le pack** pour changer son prix ou son contenu.

---

## 4. Les commandes

- Filtrez par statut (Payées, En attente, Échouées, Remboursées), par moyen de paiement ou par date.
- Cliquez sur une commande pour voir son **historique** (création, confirmation par l'opérateur…).
- **Renvoyer le reçu** : renvoie l'e-mail de reçu au client.
- **Rembourser** : le remboursement d'argent se fait depuis votre compte marchand (CinetPay). Ici, vous l'enregistrez et l'accès aux livres de la commande est retiré.
- **Valider le paiement** (commandes en attente) : uniquement si l'argent est bien arrivé sur le compte marchand.

Les **codes promo** se créent dans **Paramètres → Codes promo** (pourcentage ou montant, dates, nombre d'utilisations, œuvres concernées).

---

## 5. Les utilisateurs

Recherchez par nom, e-mail ou téléphone. La fiche d'un lecteur montre ses achats, ses appareils connectés, son journal de lecture et ses alertes. Vous pouvez :
- **Octroyer un accès** à une œuvre (geste commercial, partenaire, presse) ;
- **Déconnecter** un appareil ;
- **Bloquer** le compte en cas d'abus.

Pour un collaborateur, choisissez son **rôle** sur sa fiche : *Éditeur / community manager* (blog, commentaires, newsletter), *Comptable* (commandes, exports), *Assistant* (formations, formulaires). Chacun ne voit que son périmètre et doit lui aussi activer la double authentification.

---

## 6. Le blog et la punchline du jour

**Blog → + Nouvel article**.
- **Rubrique « Punchline du jour »** : écrivez simplement la phrase. Le site crée automatiquement l'image à partager sur WhatsApp, Instagram et TikTok.
- **Programmer** : choisissez une date future ; l'article paraît tout seul à l'heure dite. Le **calendrier éditorial** montre le mois ; glissez une publication sur un autre jour pour la déplacer.
- **Réservé aux membres** : seuls les lecteurs inscrits voient la suite.

### Modération
La colonne de droite du Blog liste les commentaires à valider. **Valider**, **Refuser**, ou **Répondre** en tant qu'auteur (votre réponse est mise en avant). Les messages qui ressemblent à du spam sont signalés. Les **avis sur les livres** se modèrent dans l'onglet *Avis sur les livres*.

---

## 7. Les formations

1. **Formations → + Nouvelle formation** : titre, présentation, objectifs, programme, prix, formulaire d'inscription, image.
2. Sur la page de la formation : **+ Nouvelle session** (date, lieu ou lien de visioconférence, nombre de places).
3. Pendant les inscriptions, chaque carte de session montre le remplissage. Quand c'est complet, les suivants vont en **liste d'attente** et sont prévenus automatiquement si une place se libère.
4. Le jour J, cochez **Présent** pour chaque participant : l'**attestation PDF** devient téléchargeable (par vous et par le participant), avec un code vérifiable en ligne.
5. **E-mail groupé** : écrit à tous les inscrits confirmés de la session.

Les rappels automatiques partent la veille et une heure avant la session.

---

## 8. Les formulaires

**Formulaires → + Nouveau formulaire**. Cliquez sur un type de champ à gauche (ou glissez-le) pour l'ajouter, puis réglez-le à droite : libellé, options, obligatoire, et « Afficher seulement si… » pour une question conditionnelle. Le consentement et la protection anti-robot sont ajoutés automatiquement.

- Pour offrir un livre contre un formulaire : choisissez ce formulaire dans la fiche de l'œuvre (mode *Gratuit avec formulaire*).
- Pour une formation : choisissez-le dans la fiche de la formation.
- Onglet **Réponses** : statistiques, taux de conversion en achat, export CSV ou Excel.

---

## 9. La newsletter

**Newsletter** : liste des abonnés, segments (acheteurs, inscrits aux formations, contacts des formulaires, lecteurs inactifs), export CSV pour Brevo ou Mailchimp, et envoi direct d'un message à un segment. Un lien de désinscription est ajouté automatiquement.

---

## 10. Paramètres

- **Général** : numéro WhatsApp du support, e-mail de contact, mode maintenance (affiche une page d'attente aux visiteurs pendant une intervention).
- **Paiements** : activer ou désactiver chaque moyen de paiement.
- **Pages et bannières** : modifier *À propos*, *CGU*, *Confidentialité*, *Mentions légales*, et programmer une bannière sur l'accueil.
- **Sécurité** : nombre d'appareils par compte, seuil d'alerte de lecture, alertes anti-fraude, notes de version.

Le **Journal** (menu de gauche) garde la trace de toutes les actions faites dans le Studio : connexions, accès octroyés, remboursements, modifications.

---

## 11. Sur téléphone

Le Studio fonctionne sur mobile : la barre du bas donne accès à l'accueil, aux ventes et au contenu ; **Plus** ouvre le menu complet. Les actions rapides (modérer, octroyer un accès, écrire aux inscrits) sont sur l'écran d'accueil.

---

## 12. En cas de souci

| Situation | Que faire |
|---|---|
| Un lecteur dit avoir payé mais ne voit pas son livre | Commandes → cherchez sa commande. Si elle est « En attente » et que l'argent est arrivé sur le compte marchand : **Valider le paiement**. |
| Un lecteur ne peut plus lire (« trop d'appareils ») | Utilisateurs → sa fiche → **Déconnecter** l'ancien appareil. |
| Un lecteur n'a pas reçu l'e-mail de vérification | Il peut le renvoyer depuis son profil. Vérifiez aussi ses courriers indésirables. |
| Une copie d'un livre circule | Le filigrane (nom, e-mail, n° de commande) sur l'image permet d'identifier le compte : bloquez-le depuis sa fiche. |
| Intervention technique prévue | Paramètres → Général → **Mode maintenance**. |
