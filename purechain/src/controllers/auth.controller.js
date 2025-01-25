const db = require('../../database/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { successResponse, errorResponse } = require('../utils/responseHandler');


exports.signUp = async (req, res) => {

    const { name, nationalId, email, password, organization, sector } = req.body;

    // Validation (add password check)
    if (!name || !nationalId || !email || !password || !organization || !sector) {
      return res.status(400).json({ message: "Missing required fields" });
    }
  
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
  
    try {
      const stmt = db.prepare(`
        INSERT INTO users 
        (name, national_id, email, password, organization, sector)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
  
      const result = stmt.run(
        name, 
        nationalId, 
        email, 
        hashedPassword, 
        organization, 
        sector
      );
      
      res.status(201).json({
        message: "User registered successfully",
        userId: result.lastInsertRowid
      });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
};

exports.login = async  (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = db.prepare(`
      SELECT * FROM users WHERE email = ?
    `).get(email);

    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: "Invalid credentials" });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
};