const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const Database = require('./database');
const dotenv = require('dotenv');

// Chargement des variables d'environnement
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialisation de la base de données
const db = new Database();

// Configuration middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuration multer pour les images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// === ROUTES PRINCIPALES ===

app.get('/', async (req, res) => {
    try {
        const sortBy = req.query.sort || 'votes';
        
        const [listings, referenceAddresses] = await Promise.all([
            db.getAllFullListings(sortBy),
            db.getAllReferenceAddresses()
        ]);

        res.render('index', {
            listings: listings,
            referenceAddresses: referenceAddresses,
            currentSort: sortBy
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// === ROUTES POUR LES ANNONCES ===

app.get('/listing/:id', async (req, res) => {
    try {
        const listingId = req.params.id;
        
        const [listing, travelTimes, referenceAddresses] = await Promise.all([
            db.getListingById(listingId),
            db.getTravelTimesByListingId(listingId),
            db.getAllReferenceAddresses()
        ]);

        if (!listing) {
            return res.status(404).send('Annonce non trouvée');
        }

        res.render('listing-detail', {
            listing: listing,
            travelTimes: travelTimes,
            referenceAddresses: referenceAddresses
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/listing', upload.array('images', 10), async (req, res) => {
    try {
        const {
            url, title, type, location, address, latitude, longitude,
            size, price, description, agency_contact, conditions,
            status, appointment_date, appointment_notes
        } = req.body;

        const images = req.files ? req.files.map(file => file.filename).join(',') : '';

        const data = {
            url, title, type, location, address, latitude, longitude,
            images, size, price, description, agency_contact, conditions,
            status, appointment_date, appointment_notes
        };

        await db.createListing(data);
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur lors de la création' });
    }
});

app.put('/listing/:id', upload.array('images', 10), async (req, res) => {
    try {
        const listingId = req.params.id;
        const {
            url, title, type, location, address, latitude, longitude,
            size, price, description, agency_contact, conditions,
            status, appointment_date, appointment_notes
        } = req.body;

        let images = '';
        if (req.files && req.files.length > 0) {
            images = req.files.map(file => file.filename).join(',');
        } else if (req.body.existing_images) {
            images = req.body.existing_images;
        }

        const data = {
            url, title, type, location, address, latitude, longitude,
            images, size, price, description, agency_contact, conditions,
            status, appointment_date, appointment_notes
        };

        await db.updateListing(listingId, data);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
});

app.delete('/listing/:id', async (req, res) => {
    try {
        const listingId = req.params.id;
        await db.deleteListing(listingId);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// === ROUTES POUR LES VOTES ===

app.post('/listing/:id/vote', async (req, res) => {
    try {
        const listingId = req.params.id;
        const { direction } = req.body; // 'up' ou 'down'
        
        const increment = direction === 'up' ? 1 : -1;
        const votes = await db.updateVotes(listingId, increment);
        
        res.json({ votes: votes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur lors du vote' });
    }
});

// === ROUTES POUR LES COMMENTAIRES ===

app.post('/listing/:id/comment', async (req, res) => {
    try {
        const listingId = req.params.id;
        const { content } = req.body;

        if (!content.trim()) {
            return res.status(400).json({ error: 'Le commentaire ne peut pas être vide' });
        }

        const result = await db.addComment(listingId, content);
        res.json({ success: true, id: result.lastID });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du commentaire' });
    }
});

app.post('/listing/:id/status', async (req, res) => {
    try {
        const listingId = req.params.id;
        const { status } = req.body;

        if (!['to_contact', 'contacting', 'apt', 'visited', 'ended', 'offline'].includes(status)) {
            return res.status(400).json({ error: 'Statut invalide' });
        }

        await db.updateStatus(listingId, status);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
    }
});

// === ROUTES POUR LES ADRESSES DE RÉFÉRENCE ===

app.get('/api/reference-addresses', async (req, res) => {
    try {
        const addresses = await db.getAllReferenceAddresses();
        res.json(addresses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/reference-addresses', async (req, res) => {
    try {
        const { name, address, latitude, longitude } = req.body;

        // Vérifier qu'on n'a pas plus de 4 adresses
        const count = await db.getReferenceAddressCount();
        
        if (count >= 4) {
            return res.status(400).json({ error: 'Maximum 4 adresses de référence autorisées' });
        }

        const result = await db.createReferenceAddress(name, address, latitude, longitude);
        res.json({ success: true, id: result.lastID });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout' });
    }
});

app.put('/api/reference-addresses/:id', async (req, res) => {
    try {
        const addressId = req.params.id;
        const { name, address, latitude, longitude } = req.body;

        await db.updateReferenceAddress(addressId, name, address, latitude, longitude);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
});

app.delete('/api/reference-addresses/:id', async (req, res) => {
    try {
        const addressId = req.params.id;
        await db.deleteReferenceAddress(addressId);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// === ROUTES POUR LES SERVICES EXTERNES ===

app.post('/api/geocode', async (req, res) => {
    try {
        const { address } = req.body;

        const response = await axios.get('https://api.openrouteservice.org/geocode/search', {
            params: {
                api_key: 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjY3NWYxZjg2MmQzOTRhYmRhOTEzYzRjYWQ3NDZkODExIiwiaCI6Im11cm11cjY0In0=',
                text: address,
                size: 5
            }
        });

        if (response.data.features && response.data.features.length > 0) {
            console.log(response.data.features);
            const feature = response.data.features[0];
            res.json({
                latitude: feature.geometry.coordinates[1],
                longitude: feature.geometry.coordinates[0],
                address: feature.properties.label
            });
        } else {
            res.status(404).json({ error: 'Adresse non trouvée' });
        }
    } catch (error) {
        console.error('Erreur géocodage:', error);
        res.status(500).json({ error: 'Erreur lors du géocodage' });
    }
});

app.post('/api/travel-time', async (req, res) => {
    try {
        const { listingId, addressId } = req.body;

        const [listingRow, addressRow] = await Promise.all([
            db.getListingCoordinates(listingId),
            db.getReferenceAddressCoordinates(addressId)
        ]);

        if (!listingRow || !addressRow) {
            return res.status(404).json({ error: 'Annonce ou adresse non trouvée' });
        }

        const { latitude: fromLat, longitude: fromLon } = listingRow;
        const { latitude: toLat, longitude: toLon } = addressRow;

        const response = await axios.post('https://api.openrouteservice.org/v2/directions/driving-car', {
            coordinates: [[fromLon, fromLat], [toLon, toLat]]
        }, {
            headers: {
                'Authorization': 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjY3NWYxZjg2MmQzOTRhYmRhOTEzYzRjYWQ3NDZkODExIiwiaCI6Im11cm11cjY0In0=',
                'Content-Type': 'application/json'
            }
        });

        if (response.data.routes && response.data.routes.length > 0) {
            const duration = Math.round(response.data.routes[0].summary.duration / 60); // en minutes
            res.json({ travelTime: duration });
        } else {
            res.status(404).json({ error: 'Trajet non calculable' });
        }
    } catch (error) {
        console.error('Erreur calcul trajet:', error);
        res.status(500).json({ error: 'Erreur lors du calcul du trajet' });
    }
});

// === DÉMARRAGE DU SERVEUR ===

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Accédez à l'application sur http://localhost:${PORT}`);
});

// Fermeture propre de la base de données
process.on('SIGINT', async () => {
    try {
        await db.close();
        process.exit(0);
    } catch (error) {
        console.error('Erreur lors de la fermeture:', error);
        process.exit(1);
    }
});