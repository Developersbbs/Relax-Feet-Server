const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');

describe('Test Server', () => {
  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should return server is working', async () => {
    const res = await request(app).get('/api/test');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toBe('Server is working');
  });

  it('should return welcome message and endpoints on root', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toBe('Welcome to RelaxFeet Server API');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('endpoints');
    expect(res.body.endpoints).toHaveProperty('auth', '/api/auth');
  });

  describe('Auth Routes', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'User registered successfully');
      expect(res.body).toHaveProperty('user');
    });

    it('should login a user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
    });

    it('should not register with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'incomplete@example.com'
        });
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'All fields are required');
    });
  });
});
