import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { registerWithEmail, loginWithEmail, signInWithGoogle } from '@/lib/firebase';

const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { signIn } = useAuth();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Login flow with Firebase
        await loginWithEmail(email, password);
        toast({
          title: "Login erfolgreich",
          description: "Willkommen zurück bei DoIt!",
        });
        setLocation('/tasks');
      } else {
        // Registration flow with Firebase
        if (password !== confirmPassword) {
          throw new Error('Die Passwörter stimmen nicht überein');
        }
        
        if (password.length < 6) {
          throw new Error('Das Passwort muss mindestens 6 Zeichen lang sein');
        }
        
        // For registration, use Firebase's createUserWithEmailAndPassword
        await registerWithEmail(email, password);
        
        toast({
          title: "Registrierung erfolgreich",
          description: "Willkommen bei DoIt!",
        });
        setLocation('/tasks');
      }
    } catch (error) {
      console.error('Auth error:', error);
      
      let errorMessage = "Ein unerwarteter Fehler ist aufgetreten";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Handle Firebase specific error codes
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const firebaseError = error as { code: string };
        switch (firebaseError.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Diese E-Mail-Adresse wird bereits verwendet';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Ungültige E-Mail-Adresse';
            break;
          case 'auth/weak-password':
            errorMessage = 'Das Passwort ist zu schwach';
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorMessage = 'Ungültige E-Mail oder Passwort';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut';
            break;
        }
      }
      
      toast({
        title: "Authentifizierungsfehler",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // Redirect will happen automatically, no need to handle it here
    } catch (error) {
      console.error('Google sign in error:', error);
      toast({
        title: "Google Anmeldung fehlgeschlagen",
        description: "Bitte versuchen Sie es später erneut",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isLogin ? 'Sign In' : 'Create an Account'}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin 
              ? 'Enter your email and password to sign in to your account'
              : 'Enter your details to create a new account'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input 
                id="email" 
                type="email" 
                placeholder="email@example.com" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Input 
                id="password" 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            {!isLogin && (
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
                <Input 
                  id="confirmPassword" 
                  type="password" 
                  required={!isLogin}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">oder mit</span>
            </div>
          </div>
          
          <Button 
            type="button" 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" style={{ fill: 'currentColor' }}>
              <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972-3.332 0-6.033-2.701-6.033-6.032 0-3.331 2.701-6.032 6.033-6.032 1.498 0 2.866.559 3.921 1.488l2.806-2.805C17.527 2.988 15.195 2 12.545 2 6.963 2 2.455 6.509 2.455 12.091s4.508 10.09 10.09 10.09c8.035 0 10-6.93 9.236-11.924l-9.236-.018z" />
            </svg>
            Mit Google anmelden
          </Button>
          
          <div className="mt-4 text-center text-sm">
            {isLogin ? "Noch kein Konto? " : "Bereits ein Konto? "}
            <button 
              type="button"
              className="text-primary hover:underline focus:outline-none"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Jetzt registrieren' : 'Anmelden'}
            </button>
          </div>
        </CardContent>
        <CardFooter className="space-y-4">
          <div className="text-center text-sm">
            <p className="text-gray-500">
              Um die App zu nutzen, melden Sie sich mit Ihrem bestehenden Konto an oder erstellen Sie ein neues Konto.
            </p>
            <p className="mt-2 text-gray-500">
              Firebase-Authentifizierung mit E-Mail und Google ist aktiviert.
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AuthScreen;