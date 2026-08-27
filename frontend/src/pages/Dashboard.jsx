import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const loadTables = useCallback(async () => {
    try {
      const data = await api.tables.getAll();
      setTables(data);
    } catch (err) {
      showToast('Erro ao carregar mesas', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCreateTable(e) {
    e.preventDefault();
    setError('');
    try {
      await api.tables.create(formName, formDesc);
      setShowModal(false);
      setFormName('');
      setFormDesc('');
      showToast('Mesa criada com sucesso!');
      loadTables();
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao criar mesa');
    }
  }

  async function handleDeleteTable(e, tableId) {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja excluir esta mesa?')) return;
    try {
      await api.tables.remove(tableId);
      showToast('Mesa excluida');
      loadTables();
    } catch {
      showToast('Erro ao excluir mesa', 'error');
    }
  }

  function getMyRole(table) {
    const userId = user.id;
    if (user.role === 'ADMIN') return 'MASTER';
    const member = table.members?.find((m) => m.userId === userId || m.user?.id === userId);
    return member?.role || 'PLAYER';
  }

  if (loading) return <div className="loading">Carregando...</div>;

  return (
    <div className="dashboard">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      <div className="dashboard-header">
        <div>
          <h1>Mesas de RPG</h1>
          <span className="user-info">Olá, {user.username}</span>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>Nova Mesa</button>
          <button className="btn btn-secondary" onClick={logout}>Sair</button>
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="empty-state">
          Nenhuma mesa encontrada. Crie uma nova mesa para comecar!
        </div>
      ) : (
        <div className="table-list">
          {tables.map((item) => {
            const table = item.table || item;
            const memberCount = item.memberCount ?? table.members?.length ?? 0;
            const role = getMyRole(table);
            const tableId = table.id;
            return (
              <div
                key={tableId}
                className="table-card"
                onClick={() => navigate(`/table/${tableId}`)}
              >
                <h3>{table.name}</h3>
                <p>{table.description || 'Sem descricao'}</p>
                <div className="card-footer">
                  <span className="member-count">{memberCount} membro{memberCount !== 1 ? 's' : ''}</span>
                  <span className={`badge ${role === 'MASTER' ? 'badge-master' : 'badge-player'}`}>{role}</span>
                </div>
                {role === 'MASTER' && (
                  <button
                    className="table-card-delete"
                    onClick={(e) => handleDeleteTable(e, tableId)}
                  >Excluir</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <h2>Nova Mesa</h2>
            <form onSubmit={handleCreateTable}>
              {error && <div className="error-msg">{error}</div>}
              <div className="form-group">
                <label>Nome</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="Nome da mesa"
                />
              </div>
              <div className="form-group">
                <label>Descricao</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Descricao da mesa"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}