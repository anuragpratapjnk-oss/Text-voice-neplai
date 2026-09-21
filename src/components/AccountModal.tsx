import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Shield,
  KeyRound,
  UserPlus,
  Check,
  AlertCircle,
  X,
  Loader2,
  Clock,
  LogOut,
} from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const { user, logout, changePassword, fetchWithAuth } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'new_user'>('profile');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  // New user creation state (Admin feature)
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserError, setNewUserError] = useState<string | null>(null);
  const [newUserSuccess, setNewUserSuccess] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPassError('New password must be at least 6 characters.');
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        setPassSuccess('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPassError(res.error || 'Failed to update password.');
      }
    } catch {
      setPassError('An unexpected error occurred.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserError(null);
    setNewUserSuccess(null);

    if (!newUsername.trim() || !newUserPassword) {
      setNewUserError('Please provide username and password.');
      return;
    }

    setIsCreatingUser(true);
    try {
      const res = await fetchWithAuth('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          displayName: newDisplayName.trim() || newUsername.trim(),
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNewUserSuccess(`User "${data.user.username}" created successfully!`);
        setNewUsername('');
        setNewDisplayName('');
        setNewUserPassword('');
      } else {
        setNewUserError(data.error || 'Failed to create user account.');
      }
    } catch {
      setNewUserError('Network error while creating user.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Account Management</h3>
              <p className="text-xs text-slate-500">{user.username} ({user.role})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/30 px-6 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Profile Info
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`pb-2.5 px-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'password'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Change Password
          </button>
          {user.role === 'admin' && (
            <button
              onClick={() => setActiveTab('new_user')}
              className={`pb-2.5 px-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'new_user'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Add User
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Username</span>
                  <span className="font-semibold text-slate-800">{user.username}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Display Name</span>
                  <span className="font-semibold text-slate-800">{user.displayName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Role</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-100 text-sky-700">
                    {user.role}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Account ID</span>
                  <span className="font-mono text-[11px] text-slate-600">{user.id}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Member Since</span>
                  <span className="text-slate-600">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    logout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer border border-rose-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out of Session</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-3.5">
              {passError && (
                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}
              {passSuccess && (
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={isChangingPass}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isChangingPass ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>
          )}

          {activeTab === 'new_user' && user.role === 'admin' && (
            <form onSubmit={handleCreateUser} className="space-y-3.5">
              {newUserError && (
                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{newUserError}</span>
                </div>
              )}
              {newUserSuccess && (
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{newUserSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. editor_sarah"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin')}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="user">User (Standard Access)</option>
                  <option value="admin">Admin (Full Control)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isCreatingUser}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isCreatingUser ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Create User Account</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
