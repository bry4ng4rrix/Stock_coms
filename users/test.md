1. INSCRIPTION ADMIN (création directe)

{
  "full_name": "Admin Principal",
  "email": "admin@gmail.com",
  "password": "123456",
  "phone": "0340000000",
  "role": "admin",
  "company_name": "Smart Stock Company"
}


2. INSCRIPTION MAGASIN (EN ATTENTE ADMIN)

👉 nécessite admin_email

{
  "full_name": "Magasin Analakely",
  "email": "magasin@gmail.com",
  "password": "123456",
  "phone": "0331111111",
  "role": "magasin",
  "shop_name": "Shop Center Analakely",
  "admin_email": "admin@gmail.com"
}
3. INSCRIPTION EMPLOYER (EN ATTENTE MAGASIN OU ADMIN)

👉 peut dépendre d’un admin OU magasin

CAS 1 : lié à un MAGASIN
{
  "full_name": "John Doe",
  "email": "john@gmail.com",
  "password": "123456",
  "phone": "0322222222",
  "role": "employer",
  "position": "Caissier",
  "admin_email": "magasin@gmail.com"
}
CAS 2 : lié à un ADMIN directement
{
  "full_name": "Alice Smith",
  "email": "alice@gmail.com",
  "password": "123456",
  "phone": "0313333333",
  "role": "employer",
  "position": "Stock Manager",
  "admin_email": "admin@gmail.com"
}