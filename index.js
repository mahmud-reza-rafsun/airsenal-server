require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();

// middleware
const corsOptions = {
    origin: ['http://localhost:5173'],
    credentials: true,
    optionSuccessStatus: 200,
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser())

app.get('/', async (req, res) => {
    res.send('AIrsenal server is running');
})
app.listen(port, () => {
    console.log(`AIrsenal is running on port: ${port}`);
});

// setup mongo Server

const verifyToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).send({ success: false, message: 'unAuthorize Access' })
    };
    jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: false, message: 'Forbidden access' });
        }
        req.user = decoded;
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uuac6m8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        // all collcetions
        const userCollcetions = client.db('AIrsenal').collection('users');
        const productCollcetions = client.db('AIrsenal').collection('products');

        // jwt authenication
        app.post('/jwt', async (req, res) => {
            const body = req.body;
            const token = jwt.sign(body, process.env.SECRET_ACCESS_TOKEN, { expiresIn: '365d' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            })
                .send({ success: true });
        })
        // logout
        app.get('/logout', async (req, res) => {
            try {
                res.clearCookie('token', {
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                    .send({ success: true })
            } catch (error) {
                res.status(500).send(error);
            }
        })

        // save users in db

        app.post('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = req.body;

            // check if user exist in db
            const isExist = await userCollcetions.findOne(query);
            if (isExist) {
                return res.send(isExist);
            }
            const result = await userCollcetions.insertOne({ ...user, role: 'Customer' });
            res.send(result);
        })

        // add product
        app.post('/add-product', verifyToken, async (req, res) => {
            const data = req.body;
            const result = await productCollcetions.insertOne(data);
            res.send(result);
        });
        // get all product
        app.get('/get-product', async (req, res) => {
            const result = await productCollcetions.find().sort({ _id: -1 }).toArray();
            res.send(result);
        })
        // delete product in db

        app.delete('/get-product/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productCollcetions.deleteOne(query);
            res.send(result);
        })
        // get spesific data 
        app.get('/get-product/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productCollcetions.findOne(query);
            res.send(result);
        });
        // get my product data from db
        app.get('/my-products/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { 'owner.email': email };
            const result = await productCollcetions.find(query).toArray();
            res.send(result);
        })

        // update data in db
        app.patch('/update-product/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: data
            }
            const result = await productCollcetions.updateOne(query, updateDoc);
            res.send(result);
        });
        // get public aprove product
        app.get('/approve-products', async (req, res) => {
            const result = await productCollcetions.find({ status: "Accepted" }).toArray();;
            res.send(result);
        });
        // approve post by moderator 
        app.patch('/approve-products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: { status: "Accepted" }
            }
            const result = await productCollcetions.updateOne(query, updateDoc);
            res.send(result);
        })

        // rejected post by moderator
        app.patch('/rejected-products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: { status: "Rejected" }
            }
            const result = await productCollcetions.updateOne(query, updateDoc);
            res.send(result);
        })

        // vote update
        app.patch('/vote/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $inc: { votes: 1 }
            }
            const result = await productCollcetions.updateOne(query, updateDoc);
            res.send(result);
        })
        // trending data by vote
        app.get('/trending', async (req, res) => {
            try {
                const result = await productCollcetions.find().sort({ votes: -1 }).limit(6).toArray();
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: "Internal Server Error" });
            }
        })

        // get all products

        app.get('/all-products', async (req, res) => {
            const search = req.query.search || '';
            let query = {};
            if (search) {
                query = {
                    newTag: { $elemMatch: { $regex: search, $options: 'i' } }
                }
            }
            const result = await productCollcetions.find(query).toArray();
            res.send(result);
        });




        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);
