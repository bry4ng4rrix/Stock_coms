# API Endpoints

Base URL: `/api/users/`

## Authentication

### POST `/api/users/login/`
- **Description**: Custom login with JWT token
- **Auth**: None required
- **Body**: 
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**: JWT access and refresh tokens

### POST `/api/users/refresh/`
- **Description**: Refresh JWT access token
- **Auth**: None required
- **Body**:
  ```json
  {
    "refresh": "string"
  }
  ```
- **Response**: New access token

## User Management

### POST `/api/users/register/`
- **Description**: Register a new user
- **Auth**: None required
- **Body**: Depends on RegisterSerializer fields
- **Response**: Success message

### PUT `/api/users/approve/<user_id>/`
- **Description**: Approve a user account
- **Auth**: Required (admin or magasin role only)
- **Permissions**: IsAuthenticated, role in ["admin", "magasin"]
- **Response**: Success message

## Products

### GET `/api/users/products/`
- **Description**: List products
- **Auth**: Required
- **Permissions**: IsAuthenticated
- **Filtering**: 
  - Admin: All products
  - Magasin: Products from their magasin
  - Employer: Products from their magasin
- **Response**: List of products

### POST `/api/users/products/`
- **Description**: Create a new product
- **Auth**: Required
- **Permissions**: IsAuthenticated, role in ["admin", "magasin"]
- **Body**: Product data (magasin field optional for admin)
- **Response**: Created product

### GET `/api/users/products/<id>/`
- **Description**: Get product details
- **Auth**: Required
- **Permissions**: IsAuthenticated
- **Response**: Product details

### PUT `/api/users/products/<id>/`
- **Description**: Update a product (full update)
- **Auth**: Required
- **Permissions**: IsAuthenticated, admin only
- **Body**: Complete product data
- **Response**: Updated product

### PATCH `/api/users/products/<id>/`
- **Description**: Partially update a product
- **Auth**: Required
- **Permissions**: IsAuthenticated, admin only
- **Body**: Partial product data
- **Response**: Updated product

### DELETE `/api/users/products/<id>/`
- **Description**: Delete a product
- **Auth**: Required
- **Permissions**: IsAuthenticated, admin only
- **Response**: Success message

## Admin

### GET `/admin/`
- **Description**: Django admin panel
- **Auth**: Admin user required
