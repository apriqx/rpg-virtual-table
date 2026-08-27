import { useState, useEffect } from 'react';
import api from '../services/api';

export default function PermissionDialog({ open, onClose, token, members, tableId, mapId, onSave }) {
  const [permissions, setPermissions] = useState([]);

  useEffect(() => {
    if (!open || !token) return;
    api.tokens.getPermissions(tableId, mapId, token.id)
      .then((data) => {
        const existing = Array.isArray(data) ? data : data.permissions || [];
        const permsMap = {};
        existing.forEach((p) => {
          const uid = p.userId || p.user?.id;
          if (uid) permsMap[uid] = p;
        });
        const initial = members
          .map((m) => {
            const u = m.user || m;
            const existingPerm = permsMap[u.id];
            return {
              userId: u.id,
              username: u.username,
              canView: existingPerm?.canView ?? true,
              canMove: existingPerm?.canMove ?? true,
              canResize: existingPerm?.canResize ?? false,
              canDelete: existingPerm?.canDelete ?? false,
            };
          });
        setPermissions(initial);
      })
      .catch(() => {
        const initial = members.map((m) => {
          const u = m.user || m;
          return {
            userId: u.id,
            username: u.username,
            canView: true,
            canMove: true,
            canResize: false,
            canDelete: false,
          };
        });
        setPermissions(initial);
      });
  }, [open, token, members, tableId, mapId]);

  if (!open || !token) return null;

  function handleChange(userId, field, value) {
    setPermissions((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, [field]: value } : p))
    );
  }

  function handleSubmit() {
    const toSend = permissions.map((p) => ({
      userId: p.userId,
      canView: p.canView,
      canMove: p.canMove,
      canResize: p.canResize,
      canDelete: p.canDelete,
    }));
    onSave(toSend);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Permissoes - {token.name}</h2>
        <ul className="permission-list">
          {permissions.map((p) => (
            <li key={p.userId} className="permission-item">
              <span className="perm-name">{p.username}</span>
              <div className="perm-checks">
                <label className="perm-check">
                  <input
                    type="checkbox"
                    checked={p.canView}
                    onChange={(e) => handleChange(p.userId, 'canView', e.target.checked)}
                  />
                  Visualizar
                </label>
                <label className="perm-check">
                  <input
                    type="checkbox"
                    checked={p.canMove}
                    onChange={(e) => handleChange(p.userId, 'canMove', e.target.checked)}
                  />
                  Mover
                </label>
                <label className="perm-check">
                  <input
                    type="checkbox"
                    checked={p.canResize}
                    onChange={(e) => handleChange(p.userId, 'canResize', e.target.checked)}
                  />
                  Redim.
                </label>
                <label className="perm-check">
                  <input
                    type="checkbox"
                    checked={p.canDelete}
                    onChange={(e) => handleChange(p.userId, 'canDelete', e.target.checked)}
                  />
                  Excluir
                </label>
              </div>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Salvar</button>
        </div>
      </div>
    </div>
  );
}