## Firefox

1. **Ouvrir le gestionnaire d’extensions développeur**

   * Lance Firefox.
   * Va dans la barre d’URL et tape :

     ```
     about:debugging#/runtime/this-firefox
     ```
   * C’est la page qui permet de gérer tes extensions locales.

---

2. **Charger l'extension temporairement**

   * Clique sur **“Charger un module complémentaire temporaire”**.
   * Sélectionne **n’importe quel fichier du dossier** de l'extension (par ex. `manifest.json`).
   * Firefox chargera toute l’extension.

---

4. **Tester l’extension**

   * L'extension est dans la barre d’outils.
   * Les logs sont visibles dans la console (clic sur **“Inspecter”** à côté de l’extension).

---

⚠️ **Important** :

* L’extension disparaît au redémarrage de Firefox.
* Pour un usage permanent → il faut passer par la signature Mozilla (même pour un `.xpi` auto-hébergé).

## Chrome

    * Ouvrez chrome://extensions/ (ou edge://extensions/)
    * Activez le "Mode développeur"
    * Cliquez sur "Charger l'extension non empaquetée"
    * Sélectionnez le dossier

