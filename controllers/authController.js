const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.registerUser = async (req, res) => {
    try{
        const {name, email, password } = req.body;
        const userExists = await User.findOne({ email });
        if(userExists) return res.status(400).json({msg: "User already exists"});

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashedPassword });

        res.status(201).json(user);
    }
    catch(err){
        res.status(500).json({error: err.message });
    }
};

exports.loginUser = async (req, res) => {
    try{
        const { email, password } = req.body;
        const user = await User.findOne({email});
        if(!user) return res.status(400).json({msg: "Invalid Credentials"});

        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch) return res.status(400).json({msg: "Invalid Credentials"});

        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({token, user:{id: user._id, name: user.name, email: user.email}});
    }
    catch(err){
        res.status(500).json({error: err.message });
    }
};