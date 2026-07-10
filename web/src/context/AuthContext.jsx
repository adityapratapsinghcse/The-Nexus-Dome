import { createContext, useContext, useState, useEffect } from 'react';
import { setupPushNotifications } from '../native/setupPushNotifications';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('smartnest_token'));
  const [householdId, setHouseholdId] = useState(() =>
    localStorage.getItem('smartnest_household_id')
  );
  const [householdName, setHouseholdName] = useState(() =>
    localStorage.getItem('smartnest_household_name')
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On app load, if we have a token but no household yet, fetch it
    if (token && !householdId) {
      client
        .get('/api/auth/my-households/')
        .then((res) => {
          if (res.data.length > 0) {
            const first = res.data[0];

            setHouseholdId(first.household);
            setHouseholdName(first.household_name);

            localStorage.setItem(
              'smartnest_household_id',
              first.household
            );
            localStorage.setItem(
              'smartnest_household_name',
              first.household_name
            );

            setupPushNotifications();
          }
        })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username, password) => {
    const res = await client.post('/api/auth/login/', {
      username,
      password,
    });

    const newToken = res.data.token;

    // Store auth data
    localStorage.setItem('smartnest_token', newToken);
    localStorage.setItem('smartnest_username', username);

    setToken(newToken);

    setupPushNotifications();

    const householdsRes = await client.get('/api/auth/my-households/', {
      headers: {
        Authorization: `Token ${newToken}`,
      },
    });

    if (householdsRes.data.length > 0) {
      const first = householdsRes.data[0];

      setHouseholdId(first.household);
      setHouseholdName(first.household_name);

      localStorage.setItem(
        'smartnest_household_id',
        first.household
      );
      localStorage.setItem(
        'smartnest_household_name',
        first.household_name
      );
    }
  };

  const register = async (
    username,
    email,
    password,
    householdName
  ) => {
    const res = await client.post('/api/auth/register/', {
      username,
      email,
      password,
      household_name: householdName,
    });

    // Store auth data
    localStorage.setItem('smartnest_token', res.data.token);
    localStorage.setItem('smartnest_username', username);
    localStorage.setItem('smartnest_household_id',res.data.household.id);
    localStorage.setItem('smartnest_household_name',res.data.household.name);

    setToken(res.data.token);
    setHouseholdId(res.data.household.id);
    setHouseholdName(res.data.household.name);

    setupPushNotifications();
  };

  const logout = () => {
    localStorage.removeItem('smartnest_token');
    localStorage.removeItem('smartnest_username');
    localStorage.removeItem('smartnest_household_id');
    localStorage.removeItem('smartnest_household_name');

    setToken(null);
    setHouseholdId(null);
    setHouseholdName(null);
  };

  return (
    <AuthContext.Provider value={{token,householdId,householdName,loading,login,register,logout,}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}