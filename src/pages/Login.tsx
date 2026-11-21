import { useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Field, TextInput, spring } from '../components/ui';
import { Icon } from '../components/Icon';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      const target = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(target, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Connexion impossible.');
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <motion.div
        className="auth__panel"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduce ? { duration: 0.18 } : spring}
      >
        <div className="auth__brand">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="26" height="26" fill="none">
              <path
                d="M7 22.5V13a9 9 0 0 1 18 0v9.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path d="M7 22.5h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="16" cy="17.4" r="2.1" fill="currentColor" />
            </svg>
          </span>
          <div>
            <strong className="brand__name">AtelierPro</strong>
            <span className="brand__tag">Gestion d’atelier</span>
          </div>
        </div>

        <div className="auth__intro">
          <p className="eyebrow">Espace de travail</p>
          <h1 className="auth__title">Connexion</h1>
          <p className="auth__lede">
            Accédez aux dossiers de l’atelier. Chaque action est enregistrée et rattachée à votre
            compte.
          </p>
        </div>

        <form className="form" onSubmit={submit} noValidate>
          <Field label="Adresse e-mail" htmlFor="login-email">
            <TextInput
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="prenom@atelier.fr"
              required
              autoFocus
            />
          </Field>

          <Field label="Mot de passe" htmlFor="login-password">
            <TextInput
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••"
              required
            />
          </Field>

          {error && (
            <p className="auth__error" role="alert">
              <Icon name="clock" size={15} />
              {error}
            </p>
          )}

          <Button
            variant="primary"
            type="submit"
            icon="check"
            disabled={busy || !email || !password}
            className="auth__submit"
          >
            {busy ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>

        <p className="auth__foot">
          Compte oublié ou mot de passe perdu ? Contactez l’administrateur de votre atelier.
        </p>
      </motion.div>

      <p className="auth__legal">
        AtelierPro 2.0 · logiciel installé sur votre serveur · aucune donnée transmise à un tiers
      </p>
    </div>
  );
}
