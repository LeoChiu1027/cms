# Auth Module Sequence Diagrams

## 1. User Registration Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AC as AuthController
    participant AS as AuthService
    participant DB as Database

    C->>AC: POST /auth/register {email, password, firstName?, lastName?}
    AC->>AC: Validate DTO (class-validator)

    alt Validation fails
        AC-->>C: 400 Bad Request (validation errors)
    end

    AC->>AS: register(registerDto)
    AS->>DB: Check if email exists

    alt Email exists
        AS-->>AC: throw ConflictException
        AC-->>C: 409 Conflict (email already exists)
    end

    AS->>AS: Hash password (bcrypt)
    AS->>DB: Insert user
    AS->>AS: Generate access token (JWT, 15min)
    AS->>AS: Generate refresh token (JWT, 7d)
    AS->>AS: Hash refresh token
    AS->>DB: Insert session (token_hash, user_id, expires_at)
    AS-->>AC: {accessToken, refreshToken, user}
    AC-->>C: 201 Created {accessToken, refreshToken, expiresIn, user}
```

## 2. User Login Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AC as AuthController
    participant AS as AuthService
    participant DB as Database

    C->>AC: POST /auth/login {email, password}
    AC->>AC: Validate DTO
    AC->>AS: login(loginDto, ipAddress, userAgent)
    AS->>DB: Find user by email

    alt User not found
        AS-->>AC: throw UnauthorizedException
        AC-->>C: 401 Unauthorized
    end

    AS->>AS: Compare password (bcrypt)

    alt Password invalid
        AS-->>AC: throw UnauthorizedException
        AC-->>C: 401 Unauthorized
    end

    alt User inactive
        AS-->>AC: throw UnauthorizedException
        AC-->>C: 401 Unauthorized (account disabled)
    end

    AS->>DB: Update user.last_login_at
    AS->>AS: Generate access token (JWT, 15min)
    AS->>AS: Generate refresh token (JWT, 7d)
    AS->>AS: Hash refresh token
    AS->>DB: Insert session (token_hash, user_id, ip, user_agent, expires_at)
    AS-->>AC: {accessToken, refreshToken, user}
    AC-->>C: 200 OK {accessToken, refreshToken, expiresIn, user}
```

## 3. Token Refresh Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AC as AuthController
    participant AS as AuthService
    participant DB as Database

    C->>AC: POST /auth/refresh {refreshToken}
    AC->>AC: Validate DTO
    AC->>AS: refreshTokens(refreshToken)
    AS->>AS: Verify JWT signature

    alt JWT invalid/expired
        AS-->>AC: throw UnauthorizedException
        AC-->>C: 401 Unauthorized (invalid token)
    end

    AS->>AS: Hash refresh token
    AS->>DB: Find session by token_hash

    alt Session not found
        AS-->>AC: throw UnauthorizedException
        AC-->>C: 401 Unauthorized (session not found)
    end

    alt Session expired
        AS->>DB: Delete expired session
        AS-->>AC: throw UnauthorizedException
        AC-->>C: 401 Unauthorized (session expired)
    end

    AS->>DB: Find user by session.user_id

    alt User inactive
        AS->>DB: Delete session
        AS-->>AC: throw UnauthorizedException
        AC-->>C: 401 Unauthorized (account disabled)
    end

    AS->>DB: Delete old session
    AS->>AS: Generate new access token
    AS->>AS: Generate new refresh token
    AS->>AS: Hash new refresh token
    AS->>DB: Insert new session
    AS-->>AC: {accessToken, refreshToken, user}
    AC-->>C: 200 OK {accessToken, refreshToken, expiresIn, user}
```

## 4. Logout Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AC as AuthController
    participant JG as JwtAuthGuard
    participant AS as AuthService
    participant DB as Database

    C->>AC: POST /auth/logout (Authorization: Bearer <accessToken>)
    AC->>JG: Validate access token
    JG->>JG: Verify JWT signature

    alt Token invalid
        JG-->>C: 401 Unauthorized
    end

    JG->>JG: Extract user from payload
    JG-->>AC: Request with user context
    AC->>AS: logout(userId, refreshToken?)

    alt refreshToken provided
        AS->>AS: Hash refresh token
        AS->>DB: Delete session by token_hash AND user_id
    else no refreshToken
        AS->>DB: Delete all sessions for user_id
    end

    AS-->>AC: void
    AC-->>C: 200 OK {message: "Logged out successfully"}
```

## 5. Get Current User Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AC as AuthController
    participant JG as JwtAuthGuard
    participant JS as JwtStrategy
    participant AS as AuthService
    participant DB as Database

    C->>AC: GET /auth/me (Authorization: Bearer <accessToken>)
    AC->>JG: Validate access token
    JG->>JS: validate(payload)
    JS->>DB: Find user by payload.sub (user_id)

    alt User not found
        JS-->>JG: throw UnauthorizedException
        JG-->>C: 401 Unauthorized
    end

    alt User inactive
        JS-->>JG: throw UnauthorizedException
        JG-->>C: 401 Unauthorized (account disabled)
    end

    JS-->>JG: Return user
    JG-->>AC: Request with user context
    AC->>AS: getCurrentUser(userId)
    AS->>DB: Find user by id
    AS-->>AC: User (without password_hash)
    AC-->>C: 200 OK {user}
```

## Token Structure

### Access Token Payload
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "type": "access",
  "iat": 1234567890,
  "exp": 1234568790
}
```

### Refresh Token Payload
```json
{
  "sub": "user-uuid",
  "type": "refresh",
  "jti": "unique-token-id",
  "iat": 1234567890,
  "exp": 1235172690
}
```

## Security Notes

1. **Password Hashing**: bcrypt with cost factor 12
2. **Refresh Token Storage**: Only hash stored in DB, never plain token
3. **Token Expiry**: Access 15min, Refresh 7 days
4. **Session Tracking**: IP address and user agent stored for audit
5. **Token Rotation**: Refresh token rotated on each use (old session deleted)
