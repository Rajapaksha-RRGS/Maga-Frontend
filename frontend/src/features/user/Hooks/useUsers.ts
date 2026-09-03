import { getUsers, createUser, updateUser, deleteUser, type User, type UserFormData } from '../Service/userService';
import { useState, useEffect, useCallback } from 'react';

export default function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const addUser = async (data: UserFormData) => {
    await createUser(data);
    await loadUsers();
  };

  const editUser = async (id: number, data: UserFormData) => {
    await updateUser(id, data);
    await loadUsers();
  };

  const removeUser = async (id: number) => {
    await deleteUser(id);
    await loadUsers();
  };

  return {
    users,
    loading,
    error,
    addUser,
    editUser,
    removeUser,
    refresh: loadUsers,
  };
}



