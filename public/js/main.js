// Global variables
let referenceMap = null;
let currentEditingListing = null;

// DOM ready
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Initialize reference addresses
    loadReferenceAddresses();
    
    // Initialize map if container exists
    if (document.getElementById('referenceMap')) {
        initReferenceMap();
    }

    initializeListingMap();

    // Setup form handlers
    setupFormHandlers();
}

// Navigation functions
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeNavItem = document.querySelector(`[onclick="showSection('${sectionName}')"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }
    
    // Special handling for reference addresses section
    if (sectionName === 'reference-addresses') {
        setTimeout(() => {
            if (referenceMap) {
                referenceMap.invalidateSize();
            }
        }, 100);
    }

    // Ajouter cette condition pour initialiser le calendrier
    if (sectionName === 'appointments') {
        setTimeout(() => {
            initCalendar();
        }, 100);
    }
}

// Sorting function
function handleSort() {
    const sortSelect = document.getElementById('sortSelect');
    const sortValue = sortSelect.value;
    
    window.location.href = `/?sort=${sortValue}`;
}

// Voting functions
async function vote(listingId, direction) {
    try {
        const response = await fetch(`/listing/${listingId}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ direction })
        });
        
        const data = await response.json();
        
        if (data.votes !== undefined) {
            // Update vote count in all places
            const voteCountElements = document.querySelectorAll(`[data-id="${listingId}"] .vote-count, #voteCount`);
            voteCountElements.forEach(element => {
                element.textContent = data.votes;
                
                // Add animation
                element.style.transform = 'scale(1.2)';
                element.style.color = direction === 'up' ? '#10b981' : '#ef4444';
                
                setTimeout(() => {
                    element.style.transform = 'scale(1)';
                    element.style.color = '';
                }, 200);
            });
        }
    } catch (error) {
        console.error('Error voting:', error);
        showNotification('Erreur lors du vote', 'error');
    }
}

// Listing management functions
function viewListing(listingId) {
    window.location.href = `/#listing-${listingId}`;
}

function editListing(listingId) {
    // Implementation for editing listing
    showNotification('Fonction d\'édition en développement', 'info');
}

async function deleteListing(listingId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette annonce ?')) {
        return;
    }
    
    try {
        const response = await fetch(`/listing/${listingId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Remove from DOM
            const listingCard = document.querySelector(`[data-id="${listingId}"]`);
            if (listingCard) {
                listingCard.style.opacity = '0';
                listingCard.style.transform = 'scale(0.8)';
                
                setTimeout(() => {
                    listingCard.remove();
                    showNotification('Annonce supprimée avec succès', 'success');
                }, 300);
            } else {
                // If on detail page, redirect to home
                window.location.href = '/';
            }
        } else {
            throw new Error('Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Error deleting listing:', error);
        showNotification('Erreur lors de la suppression', 'error');
    }
}

async function shareListing(listingId) {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Annonce immobilière',
                text: 'Découvrez cette annonce immobilière',
                url: window.location.origin + `/#listing-${listingId}`
            });
            showNotification('Lien partagé avec succès', 'success');
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error sharing:', error);
                showNotification('Erreur lors du partage', 'error');
            }
        }
    } else {
        // Fallback: copy to clipboard
        const url = window.location.origin + `/#listing-${listingId}`;
        try {
            await navigator.clipboard.writeText(url);
            showNotification('Lien copié dans le presse-papier', 'success');
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            showNotification('Erreur lors de la copie', 'error');
        }
    }
}

// Comments functions
async function addComment(event, listingId) {
    event.preventDefault();
    
    const form = event.target;
    const textarea = form.querySelector('textarea');
    const content = textarea.value.trim();
    
    if (!content) {
        showNotification('Le commentaire ne peut pas être vide', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/listing/${listingId}/comment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });
        
        if (response.ok) {
            // Trouver la liste des commentaires dans le même conteneur que le formulaire
            const commentsLine = form.closest('.comments-line');
            const commentsList = commentsLine.querySelector('.comments-list');
            const noCommentsMsg = commentsList.querySelector('.no-comments');
            
            if (noCommentsMsg) {
                noCommentsMsg.remove();
            }
            
            const commentDiv = document.createElement('div');
            commentDiv.className = 'comment-item';
            commentDiv.innerHTML = `
                <i class="fas fa-comment"></i>
                <span>${escapeHtml(content)}</span>
            `;
            
            // Add animation
            commentDiv.style.opacity = '0';
            commentDiv.style.transform = 'translateX(-20px)';
            commentDiv.style.transition = 'all 0.3s ease';
            commentsList.insertBefore(commentDiv, commentsList.firstChild);
            
            setTimeout(() => {
                commentDiv.style.opacity = '1';
                commentDiv.style.transform = 'translateX(0)';
            }, 10);
            
            // Clear textarea
            textarea.value = '';
            
            showNotification('Commentaire ajouté avec succès', 'success');
        } else {
            throw new Error('Erreur lors de l\'ajout');
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        showNotification('Erreur lors de l\'ajout du commentaire', 'error');
    }
}

// Reference addresses functions
async function loadReferenceAddresses() {
    try {
        const response = await fetch('/api/reference-addresses');
        const addresses = await response.json();
        
        renderReferenceAddresses(addresses);
        updateReferenceMap(addresses);
    } catch (error) {
        console.error('Error loading addresses:', error);
    }
}

function renderReferenceAddresses(addresses) {
    const grid = document.getElementById('addressesGrid');
    if (!grid) return;
    
    if (addresses.length === 0) {
        return;
    }
    
    grid.innerHTML = addresses.map(address => `
        <div class="address-card" data-id="${address.id}">
            <h3 class="address-card-title">
                <i class="fas fa-map-marker-alt"></i>
                ${escapeHtml(address.name)}
            </h3>
            <p class="address-text">${escapeHtml(address.address)}</p>
            <div class="address-actions">
                <button class="btn btn-outline" onclick="editAddress(${address.id})">
                    <i class="fas fa-edit"></i> Modifier
                </button>
                <button class="btn btn-danger" onclick="deleteAddress(${address.id})">
                    <i class="fas fa-trash"></i> Supprimer
                </button>
            </div>
        </div>
    `).join('');
}

function initReferenceMap() {
    const mapContainer = document.getElementById('referenceMap');
    if (!mapContainer) return;
    
    referenceMap = L.map('referenceMap').setView([48.8566, 2.3522], 15); // Paris par défaut
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(referenceMap);
}

function updateReferenceMap(addresses) {
    if (!referenceMap) return;
    
    // Clear existing markers
    referenceMap.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            referenceMap.removeLayer(layer);
        }
    });
    
    if (addresses.length === 0) return;
    
    const bounds = [];
    const colors = ['#f97316', '#fbbf24', '#10b981', '#3b82f6'];
    
    addresses.forEach((address, index) => {
        if (address.latitude && address.longitude) {
            const marker = L.marker([address.latitude, address.longitude])
                .addTo(referenceMap)
                .bindPopup(`
                    <div class="marker-popup">
                        <strong>${escapeHtml(address.name)}</strong><br>
                        ${escapeHtml(address.address)}
                    </div>
                `);
            
            bounds.push([address.latitude, address.longitude]);
        }
    });
    
    if (bounds.length > 0) {
        if (bounds.length === 1) {
            referenceMap.setView(bounds[0], 15);
        } else {
            referenceMap.fitBounds(bounds, { padding: [20, 20] });
        }
    }
}

function showAddAddressModal() {
    const modal = document.getElementById('addAddressModal');
    modal.classList.add('active');
    
    // Reset form
    const form = document.getElementById('addAddressForm');
    form.reset();
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
}

async function editAddress(addressId) {
    showNotification('Fonction d\'édition d\'adresse en développement', 'info');
}

async function deleteAddress(addressId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette adresse ?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/reference-addresses/${addressId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadReferenceAddresses();
            showNotification('Adresse supprimée avec succès', 'success');
        } else {
            throw new Error('Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Error deleting address:', error);
        showNotification('Erreur lors de la suppression', 'error');
    }
}

function initializeListingMap() {
    const mapElements = document.querySelectorAll('.listing-map');
    if (!mapElements.length) return;

    mapElements.forEach(element => {
        const lat = parseFloat(element.dataset.lat);
        const lng = parseFloat(element.dataset.lng);
        const title = element.dataset.title;
        const mapId = element.id;

        if (!lat || !lng || !mapId) return;

        console.log("Initializing map for listing:", mapId, "at coordinates:", lat, lng);
        
        // Vérifier que l'élément existe et n'a pas déjà été initialisé
        if (element && !element.hasAttribute('data-map-initialized')) {
            const map = L.map(mapId).setView([lat, lng], 10);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            L.marker([lat, lng])
                .addTo(map)
            
            // Marquer comme initialisé
            element.setAttribute('data-map-initialized', 'true');
        }
    });
}

// Form handlers
function setupFormHandlers() {
    // Add address form
    const addAddressForm = document.getElementById('addAddressForm');
    if (addAddressForm) {
        addAddressForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const addressData = {
                name: formData.get('name'),
                address: formData.get('address')
            };
            
            // Geocode address
            try {
                const geoResponse = await fetch('/api/geocode', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ address: addressData.address })
                });
                
                if (geoResponse.ok) {
                    const geoData = await geoResponse.json();
                    addressData.latitude = geoData.latitude;
                    addressData.longitude = geoData.longitude;
                    addressData.address = geoData.address; // Use normalized address
                }
            } catch (error) {
                console.warn('Geocoding failed, using manual address');
            }
            
            // Save address
            try {
                const response = await fetch('/api/reference-addresses', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(addressData)
                });
                
                if (response.ok) {
                    closeModal('addAddressModal');
                    loadReferenceAddresses();
                    showNotification('Adresse ajoutée avec succès', 'success');
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erreur lors de l\'ajout');
                }
            } catch (error) {
                console.error('Error adding address:', error);
                showNotification(error.message, 'error');
            }
        });
    }
}

// Geocoding functions
async function geocodeAddress() {
    const addressInput = document.getElementById('address');
    const address = addressInput.value.trim();
    
    if (!address) {
        showNotification('Veuillez saisir une adresse', 'error');
        return;
    }
    
    try {
        showNotification('Géolocalisation en cours...', 'info');
        
        const response = await fetch('/api/geocode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ address })
        });
        
        if (response.ok) {
            const data = await response.json();

            console.log(data)
            
            // Update form fields
            document.getElementById('latitude').value = data.latitude;
            document.getElementById('longitude').value = data.longitude;
            addressInput.value = data.address;
            
            showNotification('Adresse géolocalisée avec succès', 'success');
        } else {
            throw new Error('Adresse non trouvée');
        }
    } catch (error) {
        console.error('Geocoding error:', error);
        showNotification('Impossible de géolocaliser cette adresse', 'error');
    }
}

// Travel time calculation
async function calculateTravelTime(listingId, addressId) {
    const button = event.target;
    const originalText = button.innerHTML;
    
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calcul...';
    button.disabled = true;
    
    try {
        // Get listing coordinates (this would need to be passed from the server)
        const listingResponse = await fetch(`/api/travel-time/`, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json'
            },
            body: JSON.stringify({ listingId, addressId })
        });

        const travelData = await listingResponse.json();

        if (travelData.error) {
            throw new Error(travelData.error);
        }

        setTimeout(() => {
            button.innerHTML = `${travelData.travelTime} min`;
            button.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('Error calculating travel time:', error);
        button.innerHTML = originalText;
        button.disabled = false;
        showNotification('Erreur lors du calcul', 'error');
    }
}

// Detail page functions
function changeMainImage(src, thumbnail) {
    // Trouver la galerie parent de la miniature
    const gallery = thumbnail.closest('.image-gallery');
    if (!gallery) return;
    
    const mainImage = gallery.querySelector('.main-image img');
    if (mainImage) {
        mainImage.src = src;
        
        // Update thumbnail active state dans cette galerie seulement
        gallery.querySelectorAll('.thumbnail').forEach(thumb => {
            thumb.classList.remove('active');
        });
        thumbnail.classList.add('active');
    }
}

let currentImageIndex = 0;
function changeMainImageDirection(direction) {
    // Trouver la galerie à partir du bouton cliqué
    const button = event.target.closest('.prev_btn, .next_btn');
    const gallery = button.closest('.image-gallery');
    if (!gallery) return;
    
    const thumbnails = gallery.querySelectorAll('.thumbnail');
    const activeThumbnail = gallery.querySelector('.thumbnail.active');
    const total = thumbnails.length;
    
    if (total === 0) return;
    
    let currentImageIndex = Array.from(thumbnails).indexOf(activeThumbnail);
    
    if (direction === 'next') {
        currentImageIndex = (currentImageIndex + 1) % total;
    } else if (direction === 'prev') {
        currentImageIndex = (currentImageIndex - 1 + total) % total;
    }

    navigateToImage(gallery, currentImageIndex);
}

function navigateToImage(gallery, index) {
    const thumbnails = gallery.querySelectorAll('.thumbnail');
    const total = thumbnails.length;

    // Ensure index is within bounds
    if (index < 0 || index >= total) return;

    // Change main image
    const mainImage = gallery.querySelector('.main-image img');
    if (mainImage) {
        mainImage.src = thumbnails[index].src;
    }

    // Update thumbnail active state
    thumbnails.forEach(thumb => {
        thumb.classList.remove('active');
    });
    thumbnails[index].classList.add('active');
}

function toggleOnline(listingId) {
    // Implementation for toggling online status
    showNotification('Fonction de basculement en ligne/hors ligne en développement', 'info');
}

function scheduleAppointment(listingId) {
    // Implementation for scheduling appointment
    showNotification('Fonction de planification de rendez-vous en développement', 'info');
}

// Utility functions
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icon = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-triangle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    }[type] || 'fa-info-circle';
    
    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${escapeHtml(message)}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add styles if not already added
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 10000;
                min-width: 300px;
                max-width: 500px;
                animation: slideInRight 0.3s ease-out;
                border-left: 4px solid;
            }
            
            .notification-success { border-left-color: #10b981; }
            .notification-error { border-left-color: #ef4444; }
            .notification-warning { border-left-color: #f59e0b; }
            .notification-info { border-left-color: #3b82f6; }
            
            .notification i:first-child {
                font-size: 18px;
            }
            
            .notification-success i:first-child { color: #10b981; }
            .notification-error i:first-child { color: #ef4444; }
            .notification-warning i:first-child { color: #f59e0b; }
            .notification-info i:first-child { color: #3b82f6; }
            
            .notification span {
                flex: 1;
                font-weight: 500;
                color: #374151;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: #6b7280;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.15s ease;
            }
            
            .notification-close:hover {
                background: #f3f4f6;
                color: #374151;
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Event listeners for modal closing
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// Variables globales pour la modal de statut
let currentStatusListingId = null;

// Fonction pour ouvrir la modal de changement de statut
function changeStatus(listingId) {
    currentStatusListingId = listingId;
    
    // Trouver le bouton qui a été cliqué
    const button = event.target.closest('.btn');
    const modal = document.getElementById('statusModal');
    const overlay = document.getElementById('statusModalOverlay');
    
    // Calculer la position de la modal
    const buttonRect = button.getBoundingClientRect();
    const modalWidth = 200; // Largeur approximative de la modal
    
    // Positionner la modal au-dessus du bouton, centrée
    modal.style.left = `${buttonRect.left + (buttonRect.width / 2) - (modalWidth / 2)}px`;
    modal.style.top = `${buttonRect.top}px`; // 10px au-dessus du bouton
    
    // Ajuster si la modal dépasse de l'écran
    const modalRect = modal.getBoundingClientRect();
    if (modalRect.left < 10) {
        modal.style.left = '10px';
    }
    if (modalRect.right > window.innerWidth - 10) {
        modal.style.left = `${window.innerWidth - modalWidth - 10}px`;
    }
    
    // Afficher la modal et l'overlay
    overlay.classList.add('active');
    modal.classList.add('active');
    
    // Prévenir la propagation pour éviter la fermeture immédiate
    event.stopPropagation();
}

// Fonction pour fermer la modal de statut
function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    const overlay = document.getElementById('statusModalOverlay');
    
    modal.classList.remove('active');
    overlay.classList.remove('active');
    currentStatusListingId = null;
}

// Fonction pour sélectionner un statut
async function selectStatus(newStatus) {
    if (!currentStatusListingId) return;
    
    try {
        showNotification('Mise à jour du statut...', 'info');
        
        const response = await fetch(`/listing/${currentStatusListingId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            // Mettre à jour le badge de statut dans le DOM
            const listingCard = document.querySelector(`[data-id="${currentStatusListingId}"]`);
            if (listingCard) {
                const statusBadge = listingCard.querySelector('.status-badge');
                if (statusBadge) {
                    // Supprimer les anciennes classes de statut
                    statusBadge.className = statusBadge.className.replace(/status-\w+/g, '');
                    
                    // Ajouter la nouvelle classe de statut
                    statusBadge.classList.add(`status-${newStatus}`);
                    statusBadge.classList.add(`status-badge`);
                    
                    // Mettre à jour le texte
                    const statusTexts = {
                        'evaluating': 'En évaluation',
                        'waiting_for_call': 'En attente d\'appel',
                        'to_contact': 'À contacter',
                        'to_recontact': 'À recontacter',
                        'contacting': 'En contact', 
                        'apt': 'RDV prévu',
                        'visited': 'Visite faite',
                        'ended': 'Terminée'
                    };
                    
                    statusBadge.textContent = statusTexts[newStatus] || newStatus;
                    
                    // Animation de mise à jour
                    statusBadge.style.transform = 'scale(1.05)';
                    setTimeout(() => {
                        statusBadge.style.transform = 'scale(1)';
                    }, 200);
                }
            }
            
            showNotification('Statut mis à jour avec succès', 'success');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erreur lors de la mise à jour');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification(error.message, 'error');
    }
    
    // Fermer la modal
    closeStatusModal();
}

// Fermer la modal si on clique ailleurs
document.addEventListener('click', function(e) {
    const modal = document.getElementById('statusModal');
    const overlay = document.getElementById('statusModalOverlay');
    
    if (modal && modal.classList.contains('active') && 
        !modal.contains(e.target) && 
        !e.target.closest('[onclick*="changeStatus"]')) {
        closeStatusModal();
    }
});

let currentAppointmentListingId = null;

// Fonction pour ouvrir la modal de rendez-vous
function scheduleAppointment(listingId) {
    currentAppointmentListingId = listingId;
    
    // Pré-remplir avec la date existante si elle existe
    const listingCard = document.querySelector(`[data-id="${listingId}"]`);
    const existingAppointment = listingCard.querySelector('.appointment-banner');
    
    const modal = document.getElementById('appointmentModal');
    const dateInput = document.getElementById('appointmentDate');
    const notesInput = document.getElementById('appointmentNotes');
    
    // Reset form
    document.getElementById('appointmentForm').reset();
    
    // Si un RDV existe déjà, extraire les informations
    if (existingAppointment) {
        // Cette partie nécessiterait d'avoir les données depuis le serveur
        // Pour l'instant on laisse vide pour permettre la modification
    }
    
    // Set minimum date to now
    const now = new Date();
    const minDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    dateInput.min = minDate;
    
    modal.classList.add('active');
    dateInput.focus();
}

// Gestionnaire de soumission du formulaire de rendez-vous
document.getElementById('appointmentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentAppointmentListingId) return;
    
    const formData = new FormData(e.target);
    const appointmentData = {
        date: formData.get('date'),
        notes: formData.get('notes') || ''
    };
    
    try {
        showNotification('Programmation du rendez-vous...', 'info');
        
        const response = await fetch(`/listing/${currentAppointmentListingId}/appointment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(appointmentData)
        });
        
        if (response.ok) {
            await updateAppointmentDisplay(currentAppointmentListingId, appointmentData);
            closeModal('appointmentModal');
            showNotification('Rendez-vous programmé avec succès', 'success');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erreur lors de la programmation');
        }
    } catch (error) {
        console.error('Error scheduling appointment:', error);
        showNotification(error.message, 'error');
    }
});

// Fonction pour mettre à jour l'affichage du rendez-vous
async function updateAppointmentDisplay(listingId, appointmentData) {
    const listingCard = document.querySelector(`[data-id="${listingId}"]`);
    if (!listingCard) return;
    
    // Supprimer l'ancienne bannière de RDV si elle existe
    const existingBanner = listingCard.querySelector('.appointment-banner');
    if (existingBanner) {
        existingBanner.remove();
    }
    
    // Créer la nouvelle bannière
    const appointmentDate = new Date(appointmentData.date);
    const formattedDate = appointmentDate.toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const banner = document.createElement('div');
    banner.className = 'appointment-banner';
    banner.innerHTML = `
        <i class="fas fa-calendar-check"></i>
        RDV: ${formattedDate}
    `;
    
    // Ajouter après le card-header
    const cardHeader = listingCard.querySelector('.card-header');
    cardHeader.insertAdjacentElement('afterend', banner);
    
    // Animation d'apparition
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(-10px)';
    banner.style.transition = 'all 0.3s ease';
    
    setTimeout(() => {
        banner.style.opacity = '1';
        banner.style.transform = 'translateY(0)';
    }, 10);
    
    // Mettre à jour le bouton de programmation
    const scheduleBtn = listingCard.querySelector('[onclick*="scheduleAppointment"]');
    if (scheduleBtn) {
        scheduleBtn.innerHTML = '<i class="fas fa-calendar-edit"></i> Modifier le RDV';
    }
}

// Fonction pour annuler un rendez-vous
async function cancelAppointment(listingId) {
    if (!confirm('Êtes-vous sûr de vouloir annuler ce rendez-vous ?')) {
        return;
    }
    
    try {
        showNotification('Annulation du rendez-vous...', 'info');
        
        const response = await fetch(`/listing/${listingId}/appointment`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Supprimer la bannière de RDV
            const listingCard = document.querySelector(`[data-id="${listingId}"]`);
            const appointmentBanner = listingCard.querySelector('.appointment-banner');
            
            if (appointmentBanner) {
                appointmentBanner.style.opacity = '0';
                appointmentBanner.style.transform = 'translateY(-10px)';
                setTimeout(() => appointmentBanner.remove(), 300);
            }
            
            // Remettre le bouton original
            const scheduleBtn = listingCard.querySelector('[onclick*="scheduleAppointment"]');
            if (scheduleBtn) {
                scheduleBtn.innerHTML = '<i class="fas fa-calendar-plus"></i> Programmer un RDV';
            }
            
            showNotification('Rendez-vous annulé avec succès', 'success');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erreur lors de l\'annulation');
        }
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        showNotification(error.message, 'error');
    }
}

// Variables globales pour le calendrier
let currentDate = new Date();
let selectedDate = null;
let appointmentsData = {}; // Sera populé avec les données des rendez-vous

// Initialisation du calendrier
function initCalendar() {
    // Populate appointments data from server data
    populateAppointmentsData();
    renderCalendar();
}

async function populateAppointmentsData() {
    // Cette fonction devra être adaptée selon vos données server-side
    // Pour l'exemple, on simule avec les données existantes
    // Récupérer les données depuis le serveur
    let listings = [];
    try {
        const response = await fetch('/appointments');
        listings = await response.json();
    } catch (error) {
        console.error('Error loading appointments:', error);
    }
    
    appointmentsData = {};
    listings.forEach(listing => {
        // Clear existing appointments data
        if (listing.appointment_date) {
            const date = new Date(listing.appointment_date);
            const dateKey = date.toDateString();
            
            if (!appointmentsData[dateKey]) {
                appointmentsData[dateKey] = [];
            }
            
            appointmentsData[dateKey].push({
                id: listing.id,
                title: listing.title,
                time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                location: listing.location || listing.address,
                notes: listing.appointment_notes,
            });
        }
    });
}

function renderCalendar() {
    const calendarGrid = document.getElementById('calendarGrid');
    const currentMonthYear = document.getElementById('currentMonthYear');
    
    // Clear existing calendar days (keep headers)
    const existingDays = calendarGrid.querySelectorAll('.calendar-day');
    existingDays.forEach(day => day.remove());
    
    // Set month/year display
    currentMonthYear.textContent = currentDate.toLocaleDateString('fr-FR', { 
        month: 'long', 
        year: 'numeric' 
    });
    
    // Get first day of month and number of days
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1));
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);
        
        const dayElement = createCalendarDay(cellDate);
        calendarGrid.appendChild(dayElement);
    }
}

function createCalendarDay(date) {
    const day = document.createElement('div');
    day.className = 'calendar-day';
    day.onclick = () => selectDate(date);
    
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
    const dateKey = date.toDateString();
    const hasAppointments = appointmentsData[dateKey] && appointmentsData[dateKey].length > 0;
    
    if (!isCurrentMonth) day.classList.add('other-month');
    if (isToday) day.classList.add('today');
    if (hasAppointments) day.classList.add('has-appointment');
    if (selectedDate && date.toDateString() === selectedDate.toDateString()) {
        day.classList.add('selected');
    }
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = date.getDate();
    day.appendChild(dayNumber);
    
    if (hasAppointments) {
        const indicator = document.createElement('div');
        indicator.className = 'calendar-appointment-indicator';
        indicator.textContent = `${appointmentsData[dateKey].length} RDV`;
        day.appendChild(indicator);
    }
    
    return day;
}

function selectDate(date) {
    selectedDate = date;
    renderCalendar();
    displayAppointmentDetails(date);
}

function displayAppointmentDetails(date) {
    const detailContainer = document.getElementById('appointmentDetail');
    const dateKey = date.toDateString();
    const appointments = appointmentsData[dateKey] || [];
    
    if (appointments.length === 0) {
        detailContainer.innerHTML = `
            <div class="no-appointment-selected">
                <i class="fas fa-calendar-day"></i>
                <p>Aucun rendez-vous prévu pour le ${date.toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                })}</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="appointment-detail-header">
            <div class="appointment-detail-date">
                <i class="fas fa-calendar-check"></i>
                ${date.toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                })}
            </div>
            <span class="badge">${appointments.length} RDV</span>
        </div>
        <div class="appointment-detail-content">
    `;
    
    appointments.forEach(appointment => {
        html += `
            <div class="appointment-item">
                <div class="appointment-item-header">
                    <div class="appointment-time">
                        <i class="fas fa-clock"></i>
                        ${appointment.time}
                    </div>
                    <div class="appointment-actions">
                        <button class="btn btn-secondary" onclick="viewListing('${appointment.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-secondary btn-warning" onclick="cancelAppointment('${appointment.id}')">
                            <i class="fas fa-calendar-times"></i>
                        </button>
                    </div>
                </div>
                <div class="appointment-title">
                    <h4>${appointment.title}</h4>
                    ${appointment.location ? `
                        <div class="appointment-location">
                            <i class="fas fa-map-marker-alt"></i>
                            ${appointment.location}
                        </div>
                    ` : ''}
                </div>
                
                ${appointment.notes ? `
                    <div class="appointment-notes">${appointment.notes}</div>
                ` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    detailContainer.innerHTML = html;
}

function previousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
}

// Initialiser le calendrier au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    // Existing initialization code...
    
    // Initialize calendar when appointments section is shown
    if (document.getElementById('appointments-section')) {
        initCalendar();
    }
});

// Fonction à appeler quand la section appointments est affichée
function showAppointmentsSection() {
    showSection('appointments');
    setTimeout(() => {
        initCalendar();
    }, 100);
}

// Fermer la modal avec Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeStatusModal();
    }
});

// Mobile menu toggle (for responsive design)
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
}

// Add mobile menu button if needed
if (window.innerWidth <= 768) {
    const mobileMenuBtn = document.createElement('button');
    mobileMenuBtn.className = 'mobile-menu-btn';
    mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
    mobileMenuBtn.onclick = toggleMobileMenu;
    
    // Add button to header or create a mobile header
    document.body.appendChild(mobileMenuBtn);
}

// Handle window resize
window.addEventListener('resize', function() {
    if (referenceMap) {
        setTimeout(() => {
            referenceMap.invalidateSize();
        }, 100);
    }
});