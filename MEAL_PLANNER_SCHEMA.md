UPDATE auth.users 
SET 
 email_confirmed_at = NOW(), 
 encrypted_password = crypt('your-password',gen_salt('bf')),
 confirmed_at = NOW()
WHERE email = 'wfmorgan@outlook.com';