const Hapi = require('@hapi/hapi');
const Joi = require('@hapi/joi');
const mysql = require('mysql');
// const uuid = require('uuid');
const nodemailer = require('nodemailer');
const { generateSixDigitToken } = require('./utils');

const server = Hapi.server({
    port: 3000,
    host: 'localhost',
});

// Konfigurasi koneksi MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'smartbiz',
});

// Connect ke MySQL
db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to MySQL');
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'rossonerro59@gmail.com', // your Gmail email address
        pass: 'hvfu xotb sgnt hirm', // your Gmail password or an app-specific password
    },
});
// Endpoint untuk forgot password
server.route({
    method: 'POST',
    path: '/forgot-password',
    options: {
        validate: {
            payload: Joi.object({
                email: Joi.string().email().required(),
            }),
        },
    },
    handler: async (request, h) => {
        const { email } = request.payload;
        const resetToken = generateSixDigitToken(); // Anda dapat menggunakan library lain atau menghasilkan token unik sesuai kebutuhan
        
        // Simpan reset token ke tabel reset_tokens di database
        const insertTokenQuery = 'INSERT INTO reset_tokens (email, token) VALUES (?, ?)';
        await new Promise((resolve, reject) => {
            db.query(insertTokenQuery, [email, resetToken], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        const mailOptions = {
            from: 'rossonerro59@gmail.com', // sender address
            to: email, // list of receivers
            subject: 'Password Reset Token', // Subject line
            text: `Your password reset token is: ${resetToken}`, // plaintext body
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email:', error);
            } else {
                console.log('Email sent:', info.response);
            }
        });

        return { status: 'success', message: 'Reset token sent successfully' };
    },
});

// Endpoint untuk reset password
server.route({
    method: 'POST',
    path: '/reset-password',
    options: {
        validate: {
            payload: Joi.object({
                email: Joi.string().email().required(),
                token: Joi.string().required(),
                newPassword: Joi.string().required(),
            }),
        },
    },
    handler: async (request, h) => {
        const { email, token, newPassword } = request.payload;

        // Periksa apakah token cocok dengan yang ada di database
        const findTokenQuery = 'SELECT * FROM reset_tokens WHERE email = ? AND token = ?';
        const tokenResults = await new Promise((resolve, reject) => {
            db.query(findTokenQuery, [email, token], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });

        if (tokenResults.length > 0) {
            // Token valid, ganti password di tabel login
            const updatePasswordQuery = 'UPDATE login SET password = ? WHERE email = ?';
            await new Promise((resolve, reject) => {
                db.query(updatePasswordQuery, [newPassword, email], (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            // Hapus token dari tabel reset_tokens (opsional)
            const deleteTokenQuery = 'DELETE FROM reset_tokens WHERE email = ? AND token = ?';
            await new Promise((resolve, reject) => {
                db.query(deleteTokenQuery, [email, token], (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            return { status: 'success', message: 'Password reset successfully' };
        } else {
            return { status: 'error', message: 'Invalid token' };
        }
    },
});

// Start server
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
