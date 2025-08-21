let images = [];
let selectedImages = new Set();

// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', function() {
    console.log('Extension chargée');
    
    // Éléments DOM
    const scanBtn = document.getElementById('scanBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const clearBtn = document.getElementById('clearBtn');
    const imageGrid = document.getElementById('imageGrid');
    const status = document.getElementById('status');
    const minWidth = document.getElementById('minWidth');
    const minHeight = document.getElementById('minHeight');
    
    // Vérifier que tous les éléments sont trouvés
    if (!scanBtn || !selectAllBtn || !downloadBtn || !clearBtn) {
        console.error('Éléments DOM non trouvés');
        return;
    }
    
    console.log('Éléments DOM trouvés, ajout des listeners');
    
    // Scanner les images de la page
    scanBtn.addEventListener('click', async () => {
        console.log('Scan button clicked');
        status.textContent = 'Scan en cours...';
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('Tab trouvé:', tab.id);
            
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: scanImages,
                args: [parseInt(minWidth.value), parseInt(minHeight.value)]
            });
            
            images = results[0].result || [];
            console.log('Images trouvées:', images.length);
            displayImages();
            
            status.textContent = `${images.length} images trouvées`;
        } catch (error) {
            console.error('Erreur lors du scan:', error);
            status.textContent = 'Erreur lors du scan: ' + error.message;
        }
    });
    
    // Sélectionner toutes les images
    selectAllBtn.addEventListener('click', () => {
        console.log('Select all clicked');
        selectedImages.clear();
        images.forEach((_, index) => selectedImages.add(index));
        updateImageDisplay();
        updateDownloadButton();
    });
    
    // Télécharger les images sélectionnées
    downloadBtn.addEventListener('click', async () => {
        console.log('Download clicked, selected:', selectedImages.size);
        if (selectedImages.size === 0) return;
        
        status.textContent = `Téléchargement de ${selectedImages.size} images...`;
        
        let downloaded = 0;
        for (const index of selectedImages) {
            const image = images[index];
            try {
                await chrome.downloads.download({
                    url: image.src,
                    filename: `image_${Date.now()}_${downloaded + 1}.${getFileExtension(image.src)}`
                });
                downloaded++;
                console.log('Image téléchargée:', image.src);
            } catch (error) {
                console.error('Erreur téléchargement:', error);
            }
        }
        
        status.textContent = `${downloaded} images téléchargées`;
        selectedImages.clear();
        updateImageDisplay();
        updateDownloadButton();
    });
    
    // Effacer la sélection
    clearBtn.addEventListener('click', () => {
        console.log('Clear clicked');
        selectedImages.clear();
        images = [];
        imageGrid.innerHTML = '';
        status.textContent = 'Sélection effacée';
        updateDownloadButton();
    });
});

// Afficher les images
function displayImages() {
    console.log('Displaying images:', images.length);
    const imageGrid = document.getElementById('imageGrid');
    imageGrid.innerHTML = '';
    
    images.forEach((image, index) => {
        const div = document.createElement('div');
        div.className = 'image-item';
        div.innerHTML = `
            <img src="${image.src}" alt="Image ${index + 1}" loading="lazy">
            <div class="image-size">${image.width}x${image.height}</div>
        `;
        
        div.addEventListener('click', () => {
            console.log('Image clicked:', index);
            if (selectedImages.has(index)) {
                selectedImages.delete(index);
                div.classList.remove('selected');
            } else {
                selectedImages.add(index);
                div.classList.add('selected');
            }
            updateDownloadButton();
        });
        
        imageGrid.appendChild(div);
    });
}

// Mettre à jour l'affichage des images
function updateImageDisplay() {
    const items = document.querySelectorAll('.image-item');
    items.forEach((item, index) => {
        if (selectedImages.has(index)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// Mettre à jour le bouton de téléchargement
function updateDownloadButton() {
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.disabled = selectedImages.size === 0;
    downloadBtn.textContent = `⬇️ Télécharger (${selectedImages.size})`;
}

// Obtenir l'extension du fichier
function getFileExtension(url) {
    const match = url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i);
    return match ? match[1] : 'jpg';
}

// Fonction injectée dans la page pour scanner les images
function scanImages(minWidth, minHeight) {
    console.log('Scanning images with min size:', minWidth, 'x', minHeight);
    const images = Array.from(document.images);
    const validImages = [];
    
    images.forEach(img => {
        // Vérifier que l'image est chargée et respecte les dimensions minimales
        if (img.complete && img.naturalWidth >= minWidth && img.naturalHeight >= minHeight) {
            // Éviter les doublons
            if (!validImages.some(vi => vi.src === img.src)) {
                validImages.push({
                    src: img.src,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    alt: img.alt || 'Sans titre'
                });
            }
        }
    });
    
    console.log('Found valid images:', validImages.length);
    return validImages;
}