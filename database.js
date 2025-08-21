const sqlite3 = require('sqlite3').verbose();

class Database {
    constructor(dbPath = './real_estate.db') {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Erreur lors de l\'ouverture de la base de données:', err);
            } else {
                console.log('Connexion à la base de données SQLite établie.');
                this.initDatabase();
            }
        });
    }

    // Wrapper pour les requêtes avec promesses
    run(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ 
                        lastID: this.lastID, 
                        changes: this.changes 
                    });
                }
            });
        });
    }

    get(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Initialisation des tables
    initDatabase() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS reference_addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT,
            title TEXT,
            type TEXT,
            rooms INTEGER,
            location TEXT,
            address TEXT,
            latitude REAL,
            longitude REAL,
            images TEXT,
            size REAL,
            floor INTEGER,
            price REAL,
            charges REAL,
            description TEXT,
            agency_contact TEXT,
            conditions TEXT,
            dpe TEXT,
            heating TEXT,
            status TEXT DEFAULT 'to_contact',
            votes INTEGER DEFAULT 0,
            online BOOLEAN DEFAULT 1,
            appointment_date DATETIME,
            appointment_notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS travel_times (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER,
            reference_address_id INTEGER,
            travel_time INTEGER,
            is_manual BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE,
            FOREIGN KEY (reference_address_id) REFERENCES reference_addresses (id) ON DELETE CASCADE
            )`
            ,
                        // Add CHECK constraint for status column if it doesn't exist
                        `CREATE TRIGGER IF NOT EXISTS validate_status_insert
                         BEFORE INSERT ON listings
                         FOR EACH ROW
                         BEGIN
                             SELECT CASE
                                 WHEN NEW.status NOT IN ('evaluating', 'waiting_for_call', 'to_contact', 'contacting', 'apt', 'visited', 'ended', 'offline')
                                 THEN RAISE(ABORT, 'Invalid status value')
                             END;
                         END`,
                        
                        `CREATE TRIGGER IF NOT EXISTS validate_status_update
                         BEFORE UPDATE ON listings
                         FOR EACH ROW
                         BEGIN
                             SELECT CASE
                                 WHEN NEW.status NOT IN ('evaluating', 'waiting_for_call', 'to_contact', 'contacting', 'apt', 'visited', 'ended', 'offline')
                                 THEN RAISE(ABORT, 'Invalid status value')
                             END;
                         END`
        ];
        //CHECK(status IN ('evaluating', 'waiting_for_call', 'to_contact', 'contacting', 'apt', 'visited', 'ended', 'offline'))

        queries.forEach(query => {
            this.db.run(query);
        });
    }

    // === MÉTHODES POUR LES ANNONCES ===
    
    async getAllListings() {
        const query = `
            SELECT l.*, 
                GROUP_CONCAT(c.content, '|||') as comments,
                COUNT(DISTINCT c.id) as comment_count
            FROM listings l
            LEFT JOIN comments c ON l.id = c.listing_id ORDER BY id DESC
            GROUP BY l.id
        `;

        const listings = await this.all(query);
        return listings.map(listing => this.processListingData(listing));
    }

    async getAllFullListings(sortBy = 'votes') {
        let orderBy = 'votes DESC';
        if (sortBy === 'alphabetical') {
            orderBy = 'title ASC';
        }

        const query = `
            SELECT l.*, 
                GROUP_CONCAT(c.content, '|||') as comments,
                GROUP_CONCAT(tt.travel_time, '|||') as travel_times,
                COUNT(DISTINCT c.id) as comment_count
            FROM listings l
            LEFT JOIN comments c ON l.id = c.listing_id
            LEFT JOIN travel_times tt ON l.id = tt.listing_id
            GROUP BY l.id
            ORDER BY ${orderBy}
        `;

        const listings = await this.all(query);
        return listings.map(listing => this.processListingData(listing));
    }

    async getListingById(id) {
        const query = `
            SELECT l.*,
                GROUP_CONCAT(c.content, '|||') as comments,
                COUNT(DISTINCT c.id) as comment_count
            FROM listings l
            LEFT JOIN comments c ON l.id = c.listing_id
            WHERE l.id = ?
            GROUP BY l.id
        `;

        const listing = await this.get(query, [id]);
        
        if (!listing) {
            return null;
        }

        return this.processListingData(listing);
    }

    async createListing(data) {
        const {
            url, title, type, location, address, latitude, longitude,
            images, size, price, description, agency_contact, conditions,
            status, appointment_date, appointment_notes
        } = data;

        const query = `
            INSERT INTO listings (
            url, title, type, location, address, latitude, longitude,
            images, size, price, description, agency_contact, conditions,
            status, appointment_date, appointment_notes, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        const params = [
            url, title, type, location, address,
            latitude || null, longitude || null, images,
            size || null, price || null, description, agency_contact, conditions,
            status || 'to_contact', appointment_date || null, appointment_notes
        ];

        return await this.run(query, params);
    }

    async updateListing(id, data) {
        const {
            url, title, type, location, address, latitude, longitude,
            images, size, price, description, agency_contact, conditions,
            status, appointment_date, appointment_notes
        } = data;

        const query = `
            UPDATE listings SET
            url = ?, title = ?, type = ?, location = ?, address = ?,
            latitude = ?, longitude = ?, images = ?, size = ?, price = ?,
            description = ?, agency_contact = ?, conditions = ?, status = ?,
            appointment_date = ?, appointment_notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        const params = [
            url, title, type, location, address,
            latitude || null, longitude || null, images,
            size || null, price || null, description, agency_contact, conditions,
            status, appointment_date || null, appointment_notes, id
        ];

        return await this.run(query, params);
    }

    async deleteListing(id) {
        return await this.run('DELETE FROM listings WHERE id = ?', [id]);
    }

    // === MÉTHODES POUR LES VOTES ===

    async updateVotes(id, increment) {
        await this.run('UPDATE listings SET votes = votes + ? WHERE id = ?', [increment, id]);
        
        const result = await this.get('SELECT votes FROM listings WHERE id = ?', [id]);
        return result.votes;
    }

    async updateStatus(id, status) {
        return await this.run('UPDATE listings SET status = ? WHERE id = ?', [status, id]);
    }

    // === MÉTHODES POUR LES COMMENTAIRES ===
    
    async addComment(listingId, content) {
        return await this.run(
            'INSERT INTO comments (listing_id, content) VALUES (?, ?)',
            [listingId, content]
        );
    }

    // === MÉTHODES POUR LES RENDEZ-VOUS ===
    async updateAppointment(id, appointmentDate, appointmentNotes) {
        return await this.run(
            'UPDATE listings SET appointment_date = ?, appointment_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [appointmentDate, appointmentNotes, id]
        );
    }

    async getAllAppointments() {
        return await this.all('SELECT appointment_date, appointment_notes, id, title, location FROM listings WHERE appointment_date IS NOT NULL ORDER BY appointment_date');
    }

    // === MÉTHODES POUR LES ADRESSES DE RÉFÉRENCE ===
    
    async getAllReferenceAddresses() {
        return await this.all('SELECT * FROM reference_addresses ORDER BY created_at');
    }

    async getReferenceAddressCount() {
        const result = await this.get('SELECT COUNT(*) as count FROM reference_addresses');
        return result.count;
    }

    async createReferenceAddress(name, address, latitude, longitude) {
        return await this.run(
            'INSERT INTO reference_addresses (name, address, latitude, longitude) VALUES (?, ?, ?, ?)',
            [name, address, latitude, longitude]
        );
    }

    async updateReferenceAddress(id, name, address, latitude, longitude) {
        return await this.run(
            'UPDATE reference_addresses SET name = ?, address = ?, latitude = ?, longitude = ? WHERE id = ?',
            [name, address, latitude, longitude, id]
        );
    }

    async deleteReferenceAddress(id) {
        return await this.run('DELETE FROM reference_addresses WHERE id = ?', [id]);
    }

    // === MÉTHODES POUR LES TEMPS DE TRAJET ===

    async addTravelTime(listingId, referenceAddressId, travelTime, isManual = false) {
        const query = `
            INSERT INTO travel_times (listing_id, reference_address_id, travel_time, is_manual)
            VALUES (?, ?, ?, ?)
        `;
        const params = [listingId, referenceAddressId, travelTime, isManual];
        return await this.run(query, params);
    }

    async updateTravelTime(id, travelTime, isManual) {
        const query = `
            UPDATE travel_times
            SET travel_time = ?, is_manual = ?
            WHERE id = ?
        `;
        const params = [travelTime, isManual, id];
        return await this.run(query, params);
    }

    async getTravelTimesByListingId(listingId) {
        const query = `
            SELECT tt.*, ra.name as address_name
            FROM travel_times tt
            JOIN reference_addresses ra ON tt.reference_address_id = ra.id
            WHERE tt.listing_id = ?
        `;
        
        return await this.all(query, [listingId]);
    }

    async getListingCoordinates(id) {
        return await this.get('SELECT latitude, longitude FROM listings WHERE id = ?', [id]);
    }

    async getReferenceAddressCoordinates(id) {
        return await this.get('SELECT latitude, longitude FROM reference_addresses WHERE id = ?', [id]);
    }

    // === MÉTHODES UTILITAIRES ===
    
    processListingData(listing) {
        if (listing.images) {
            listing.images = listing.images.split(',').filter(img => img.trim());
        } else {
            listing.images = [];
        }

        if (listing.comments) {
            listing.comments = listing.comments.split('|||').filter(comment => comment.trim()).reverse();
        } else {
            listing.comments = [];
        }

        if (listing.travel_times) {
            listing.travel_times = listing.travel_times.split('|||').filter(tt => tt.trim());
        } else {
            listing.travel_times = [];
        }

        return listing;
    }

    // Fermeture de la base de données
    close() {
        return new Promise((resolve) => {
            this.db.close((err) => {
                if (err) {
                    console.error(err.message);
                }
                console.log('Connexion à la base de données fermée.');
                resolve();
            });
        });
    }
}

module.exports = Database;