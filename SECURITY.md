# Security Guidelines / إرشادات الأمان

## Environment Variables / المتغيرات البيئية

### Setup / الإعداد
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual values in `.env`

3. **NEVER** commit `.env` files with real credentials!

### Required Variables / المتغيرات المطلوبة
- `DATABASE_URL` - Database connection string
- `JWT_SECRET` - Secret key for JWT tokens (min 32 characters)

### Optional Variables / المتغيرات الاختيارية
- `RESEND_API_KEY` - For email notifications
- `TWILIO_*` - For SMS/WhatsApp notifications

## Security Checklist / قائمة التحقق الأمني

### Before Committing / قبل رفع الكود
- [ ] No hardcoded passwords in code
- [ ] No API keys in source files
- [ ] `.env` files are gitignored
- [ ] Database credentials use environment variables
- [ ] Sensitive files are in `.gitignore`

### Known Issues Found / مشاكل معروفة تم اكتشافها

**WARNING**: The following files contain or contained hardcoded credentials and should be reviewed:

1. `update_password.mjs` - Contains hardcoded database credentials
2. `scripts/create-supervisors.mjs` - Contains hardcoded default passwords
3. `.manus/db/` - Contains database query logs with sensitive data
4. `reset-password-*.mjs` - Password reset scripts

**Recommended Actions / الإجراءات المطلوبة:**
1. Rotate all exposed credentials immediately
2. Update scripts to use `process.env.DATABASE_URL`
3. Remove or encrypt `.manus/` directory contents
4. Never use simple passwords like "admin1234" or "admin123"

## API Key Security / أمان مفاتيح API

### Best Practices / أفضل الممارسات
1. **Never hardcode** API keys in source code
2. Use environment variables for all secrets
3. Rotate keys regularly
4. Use different keys for development/production
5. Set up key expiration where possible

### If a Key is Exposed / إذا تم كشف مفتاح
1. **Immediately revoke** the exposed key
2. Generate a new key
3. Update all systems using the key
4. Review access logs for unauthorized usage
5. Add the exposed key pattern to pre-commit hooks

## Database Security / أمان قاعدة البيانات

### Connection String Format
```
mysql://username:password@host:port/database
```

### Secure Practices
- Use SSL/TLS for database connections
- Use read-only users where possible
- Never log full connection strings
- Rotate database passwords regularly

## Pre-commit Hooks / خطافات ما قبل الالتزام

Consider adding these checks to your pre-commit hooks:

```bash
# Check for hardcoded secrets
git diff --cached --name-only | xargs grep -l -E '(password|secret|api[_-]?key)\s*[:=]\s*["\x27][^"\x27]+["\x27]'

# Check for .env files
git diff --cached --name-only | grep -E '\.env(\..+)?$'
```

## Contact / التواصل

If you discover a security vulnerability, please report it immediately to the security team.
