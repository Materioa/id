class UserState {
  user = $state<any>(null);
  
  get isAdmin() {
    return this.user?.hasAdminPrivileges || this.user?.plan === 'Super';
  }
  
  setUser(newUser: any) {
    this.user = newUser;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('materio_user', JSON.stringify(newUser));
    }
  }
  
  loadUser() {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('materio_user');
      if (stored) {
        try {
          this.user = JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse stored user', e);
        }
      }
    }
  }
  
  logout() {
    this.user = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('materio_user');
      localStorage.removeItem('token');
      localStorage.removeItem('user_plan');
    }
  }
  async fetchProfile() {
    if (this.user?.username && this.user?.email) {
      return this.user; // Already loaded
    }
    
    if (typeof window === 'undefined') return null;
    
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
      const res = await fetch('/api/v2/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json() as any;
        if (data && data.user) {
          this.setUser(data.user);
          return data.user;
        }
      }
    } catch (e) {
      console.error('Failed to fetch profile', e);
    }
    return null;
  }
}

export const userStore = new UserState();
