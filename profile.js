const Hapi = require('@hapi/hapi');
const Joi = require('@hapi/joi');
const fs = require('fs');
const db = require('./db');

const server = Hapi.server({
    port: 3000,
    host: 'localhost',
});

server.route({
    method: 'POST',
    path: '/upload-profile-picture',
    options: {
        payload: {
            output: 'stream',  // Output data dalam bentuk stream
            parse: true,       // Otomatis parse payload
            allow: 'multipart/form-data',  // Hanya izinkan tipe konten multipart/form-data
            maxBytes: 1024 * 1024 * 5,  // Batas ukuran file (5 MB dalam contoh ini)
            multipart: true,    // Izinkan data yang dikirim dalam bentuk multipart
        },
        validate: {
            payload: Joi.object({
                userId: Joi.number().required(),
                jsonPayload: Joi.object({
                    additionalData: Joi.string().required(),
                }),
                profilePicture: Joi.any().meta({ swaggerType: 'file' }).required(),
            }),
        },
    },
    handler: async (request, h) => {
        const { userId, profilePicture } = request.payload;

        // Simpan foto profil di server
        const filename = `profile_${userId}.png`;
        const path = `uploads/${filename}`;
        const fileStream = fs.createWriteStream(path);

        profilePicture.pipe(fileStream);

        return new Promise((resolve, reject) => {
            profilePicture.on('end', async () => {
                // Simpan path foto profil ke database
                const updateQuery = 'UPDATE login SET profile_picture = ? WHERE id = ?';

                db.query(updateQuery, [path, userId], (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ status: 'success', message: 'Profile picture updated successfully' });
                    }
                });
            });

            profilePicture.on('error', (err) => {
                reject(err);
            });
        });
    },
});

const start = async () => {
    try {
        await server.start();
        console.log('Server running on %s', server.info.uri);
    } catch (err) {
        console.error('Error starting server:', err);
        process.exit(1);
    }
};

start();
