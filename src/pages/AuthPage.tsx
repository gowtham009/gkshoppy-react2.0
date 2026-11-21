import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Store } from 'lucide-react';
import { confirmPasswordReset, startPasswordReset } from '../lib/auth';

interface AuthPageProps {
  onSuccess: () => void;
}

export default function AuthPage({ onSuccess }: AuthPageProps) {
  const { signIn, signUp, confirmSignUp } = useAuth();
  const [mode, setMode] = useState<
    'signin' | 'signup' | 'confirm-signup' | 'forgot-password' | 'confirm-reset'
  >('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const needsPassword = mode !== 'forgot-password';
  const needsCode = mode === 'confirm-signup' || mode === 'confirm-reset';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        onSuccess();
      } else if (mode === 'signup') {
        await signUp(email, password, username);
        setMode('confirm-signup');
        setNotice('Enter the confirmation code sent to your email.');
      } else if (mode === 'confirm-signup') {
        await confirmSignUp(email, code);
        await signIn(email, password);
        onSuccess();
      } else if (mode === 'forgot-password') {
        await startPasswordReset(email);
        setMode('confirm-reset');
        setNotice('Enter the password reset code sent to your email.');
      } else {
        await confirmPasswordReset(email, code, password);
        setMode('signin');
        setPassword('');
        setCode('');
        setNotice('Password reset. You can now sign in.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Store className="text-indigo-600" size={28} />
          <span className="font-bold text-xl text-indigo-600">GK Shoppy</span>
        </div>

        <h2 className="text-center text-lg font-semibold text-gray-900 mb-6">
          {mode === 'signin' ? 'Welcome back'
            : mode === 'signup' ? 'Create your account'
            : mode === 'confirm-signup' ? 'Confirm your email'
            : mode === 'forgot-password' ? 'Reset your password'
            : 'Choose a new password'}
        </h2>

        {notice && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">
            {notice}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mode === 'confirm-signup' || mode === 'confirm-reset'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          {needsCode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email code</label>
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}
          {needsPassword && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {mode === 'confirm-reset' ? 'New password' : 'Password'}
              </label>
              <input
                type="password"
                required
                minLength={mode === 'signin' ? undefined : 8}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Please wait…'
              : mode === 'signin' ? 'Sign In'
              : mode === 'signup' ? 'Sign Up'
              : mode === 'confirm-signup' ? 'Confirm and sign in'
              : mode === 'forgot-password' ? 'Send reset code'
              : 'Reset password'}
          </button>
        </form>

        {mode === 'signin' && (
          <div className="flex justify-between text-sm text-gray-500 mt-4">
            <button
              onClick={() => { setMode('signup'); setError(''); setNotice(''); }}
              className="text-indigo-600 font-medium hover:underline"
            >
              Create account
            </button>
            <button
              onClick={() => { setMode('forgot-password'); setError(''); setNotice(''); }}
              className="text-indigo-600 font-medium hover:underline"
            >
              Forgot password?
            </button>
          </div>
        )}
        {mode === 'signup' && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <button
              onClick={() => { setMode('signin'); setError(''); setNotice(''); }}
              className="text-indigo-600 font-medium hover:underline"
            >
              Sign In
            </button>
          </p>
        )}
        {(mode === 'confirm-signup' || mode === 'confirm-reset' || mode === 'forgot-password') && (
          <button
            onClick={() => { setMode('signin'); setError(''); setNotice(''); setCode(''); }}
            className="block mx-auto text-sm text-indigo-600 font-medium hover:underline mt-4"
          >
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
