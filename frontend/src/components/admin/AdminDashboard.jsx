import { useState } from 'react';
import { deleteRecord } from '../../services/recordsService';
import { updateProduct } from '../../services/adminStoreService';
import { signOut } from '../../services/authService';
import AddRecordForm from './AddRecordForm';
import ProductManagerModal from './ProductManagerModal';
import AdminOrdersTab from './AdminOrdersTab';
import AdminSupportTab from './AdminSupportTab';

export default function AdminDashboard({ records, onRecordsChange }) {
  const [activeTab, setActiveTab]         = useState('records'); // 'records', 'products', 'orders', 'support'
  const [showForm, setShowForm]           = useState(false);
  const [editRecord, setEditRecord]       = useState(null);
  const [deleting, setDeleting]           = useState(null);
  const [productRecord, setProductRecord] = useState(null); // record selected for ProductManagerModal
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  // Dynamic inline price editing
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceVal, setEditingPriceVal] = useState('');
  const [savingPriceId, setSavingPriceId]   = useState(null);


  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record permanently?')) return;
    setDeleting(id);
    try {
      await deleteRecord(id);
      onRecordsChange();
    } catch (e) {
      alert('Delete failed. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (record) => {
    setEditRecord(record);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditRecord(null);
    onRecordsChange();
  };

  const handleProductModalClose = () => {
    setProductRecord(null);
    onRecordsChange();
  };

  const handleStartEditPrice = (record) => {
    setEditingPriceId(record.id);
    setEditingPriceVal(String(record.price ?? record.product_price ?? 0));
  };

  const handleSaveQuickPrice = async (record) => {
    const num = Math.max(0, Number(editingPriceVal));
    setSavingPriceId(record.id);
    try {
      await updateProduct(record.id, {
        price: num,
        productEnabled: Boolean(record.productEnabled || record.product_enabled),
      });
      setEditingPriceId(null);
      onRecordsChange();
    } catch (err) {
      alert(err.message || 'Failed to update price');
    } finally {
      setSavingPriceId(null);
    }
  };

  const handleQuickToggleStore = async (record) => {
    const isEnabled = Boolean(record.productEnabled || record.product_enabled);
    const hasZip = Boolean(record.digital_file_path || (record.digitalFile && record.digitalFile.exists));
    if (!isEnabled && !hasZip) {
      alert('Cannot publish to store: digital ZIP has not been generated or uploaded yet. Please click "Configure Product & ZIP" to generate it first.');
      return;
    }
    try {
      await updateProduct(record.id, {
        productEnabled: !isEnabled,
        price: Number(record.price ?? record.product_price ?? 0),
      });
      onRecordsChange();
    } catch (err) {
      alert(err.message || 'Failed to update store status');
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-dashboard__header">
        <div>
          <h1 className="admin-dashboard__title">Store & Library Admin</h1>
          <p className="admin-dashboard__subtitle">CANOPUS Digital Audio & Records Management</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {activeTab === 'records' && (
            <button className="btn-primary" onClick={() => { setEditRecord(null); setShowForm(true); }}>
              + Add Record
            </button>
          )}
          {activeTab === 'products' && (
            <button className="btn-primary" onClick={() => setShowAddProductModal(true)}>
              + Add Product
            </button>
          )}
          <button className="btn-ghost" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs-nav">
        <button
          className={`admin-tab-btn${activeTab === 'records' ? ' active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          Records Library ({records.length})
        </button>
        <button
          className={`admin-tab-btn${activeTab === 'products' ? ' active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Products Store ({records.filter(r => r.productEnabled || r.product_enabled).length} Active)
        </button>
        <button
          className={`admin-tab-btn${activeTab === 'orders' ? ' active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Customer Orders
        </button>
        <button
          className={`admin-tab-btn${activeTab === 'support' ? ' active' : ''}`}
          onClick={() => setActiveTab('support')}
        >
          Support Queries
        </button>
      </div>

      {/* TAB 1: RECORDS */}
      {activeTab === 'records' && (
        <div className="admin-tab-content">
          {records.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 14 }}>
              No records yet. Add your first record.
            </p>
          ) : (
            records.map(record => (
              <div className="admin-track-row" key={record.id}>
                {record.artworkUrl ? (
                  <img className="admin-track-row__thumb" src={record.artworkUrl} alt={record.title} loading="lazy" />
                ) : (
                  <div
                    className="admin-track-row__thumb"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ivory-mid)', color: 'var(--text-faint)', fontSize: 14 }}
                  >
                    ♫
                  </div>
                )}
                <div className="admin-track-row__info">
                  <h4>{record.title}</h4>
                  <p>
                    {record.genre} · {record.tracks?.length || 0} tracks
                  </p>
                </div>
                <div className="admin-track-row__actions">
                  <button className="btn-ghost" onClick={() => handleEdit(record)}>Edit</button>
                  <button
                    className="btn-danger"
                    onClick={() => handleDelete(record.id)}
                    disabled={deleting === record.id}
                  >
                    {deleting === record.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: PRODUCTS STORE */}
      {activeTab === 'products' && (
        <div className="admin-tab-content">
          <div className="admin-products-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle, #e5e3dc)' }}>
            <div className="admin-products-intro" style={{ margin: 0, flex: 1, minWidth: 260 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Manage digital album pricing, package audio files into downloadable ZIPs, and toggle store availability.
                Use <strong>+ Add Product</strong> to publish library albums to the digital storefront.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '8px 20px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => setShowAddProductModal(true)}
            >
              + Add Product
            </button>
          </div>

          {records.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 14 }}>
              No records in library. Create a record first in the Records tab.
            </p>
          ) : (
            <div className="admin-products-grid">
              {records.map(record => {
                const isEnabled = Boolean(record.productEnabled || record.product_enabled);
                const hasZip = Boolean(record.digital_file_path || (record.digitalFile && record.digitalFile.exists));
                const price = record.price ?? record.product_price ?? 0;
                const fileSize = record.digital_file_size || (record.digitalFile && record.digitalFile.fileSize);
                const isEditingPrice = editingPriceId === record.id;

                return (
                  <div key={record.id} className={`admin-product-card${isEnabled ? ' is-active' : ''}`}>
                    <div className="admin-product-card__thumb-wrap">
                      {record.artworkUrl ? (
                        <img className="admin-product-card__thumb" src={record.artworkUrl} alt={record.title} />
                      ) : (
                        <div className="admin-product-card__thumb-placeholder">♫</div>
                      )}
                      <button
                        type="button"
                        className={`admin-product-card__status-pill ${isEnabled ? 'published' : 'draft'}`}
                        onClick={() => handleQuickToggleStore(record)}
                        title={isEnabled ? 'Click to unpublish from store' : 'Click to publish to store'}
                        style={{ border: 'none', cursor: 'pointer' }}
                      >
                        {isEnabled ? 'Store Active (Click to Hide)' : 'Draft / Off (Click to Publish)'}
                      </button>
                    </div>

                    <div className="admin-product-card__body">
                      <h3 className="admin-product-card__title">{record.title}</h3>
                      <p className="admin-product-card__meta">
                        {record.genre || 'Album'} · {record.tracks?.length || 0} tracks
                      </p>

                      <div className="admin-product-card__specs">
                        <div className="admin-product-card__spec-item">
                          <span className="spec-label">Price (INR)</span>
                          {isEditingPrice ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>₹</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                style={{
                                  width: 72,
                                  padding: '3px 6px',
                                  fontSize: 13,
                                  border: '1px solid var(--navy)',
                                  borderRadius: 2,
                                  background: 'var(--ivory)',
                                  color: 'var(--text-primary)',
                                  fontWeight: 600,
                                }}
                                value={editingPriceVal}
                                onChange={e => setEditingPriceVal(e.target.value)}
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveQuickPrice(record);
                                  if (e.key === 'Escape') setEditingPriceId(null);
                                }}
                              />
                              <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '3px 8px', fontSize: 11 }}
                                onClick={() => handleSaveQuickPrice(record)}
                                disabled={savingPriceId === record.id}
                              >
                                {savingPriceId === record.id ? '…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                className="btn-ghost"
                                style={{ padding: '3px 6px', fontSize: 11 }}
                                onClick={() => setEditingPriceId(null)}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                              <span className="spec-val">₹{price}</span>
                              <button
                                type="button"
                                className="btn-ghost"
                                style={{
                                  padding: '1px 6px',
                                  fontSize: 10,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.08em',
                                  color: 'var(--navy)',
                                  fontWeight: 600,
                                }}
                                onClick={() => handleStartEditPrice(record)}
                                title="Change price dynamically"
                              >
                                ✎ Edit
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="admin-product-card__spec-item">
                          <span className="spec-label">Digital ZIP</span>
                          <span className={`spec-val ${hasZip ? 'has-zip' : 'no-zip'}`}>
                            {hasZip ? `Ready (${formatBytes(fileSize)})` : 'Not Ready'}
                          </span>
                        </div>
                      </div>

                      <button
                        className="btn-secondary admin-product-card__manage-btn"
                        onClick={() => setProductRecord(record)}
                      >
                        Configure Product & ZIP
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ORDERS */}
      {activeTab === 'orders' && (
        <div className="admin-tab-content">
          <AdminOrdersTab />
        </div>
      )}

      {/* TAB 4: SUPPORT */}
      {activeTab === 'support' && (
        <div className="admin-tab-content">
          <AdminSupportTab />
        </div>
      )}

      {/* Add/Edit Record Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) handleFormClose(); }}>
          <div className="modal" style={{ maxWidth: 800 }}>
            <div className="modal__header">
              <h2 className="modal__title">{editRecord ? 'Edit Record' : 'Add Record'}</h2>
              <button className="modal__close" onClick={handleFormClose} aria-label="Close">×</button>
            </div>
            <AddRecordForm
              initialData={editRecord}
              onSuccess={handleFormClose}
              onCancel={handleFormClose}
            />
          </div>
        </div>
      )}

      {/* Configure Product Modal */}
      {productRecord && (
        <ProductManagerModal
          record={productRecord}
          onClose={handleProductModalClose}
          onUpdated={onRecordsChange}
        />
      )}

      {/* Add Product Modal (choose existing record or create new) */}
      {showAddProductModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAddProductModal(false); }}>
          <div className="modal" style={{ maxWidth: 650, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal__header">
              <div>
                <span className="modal__eyebrow">DIGITAL STORE</span>
                <h2 className="modal__title">Add Product to Store</h2>
              </div>
              <button className="modal__close" onClick={() => setShowAddProductModal(false)} aria-label="Close">×</button>
            </div>
            
            <div className="modal__body" style={{ padding: '20px 0 8px' }}>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Select an existing album from your library to configure pricing and publish to the digital store, or create a brand new album.
              </p>

              {/* Option 1: Create brand new record */}
              <div style={{
                padding: '16px 20px',
                background: 'var(--ivory-mid, #f4f3f0)',
                border: '1px solid var(--border-subtle, #e5e3dc)',
                borderRadius: 4,
                marginBottom: 24,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
              }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Create Brand New Album
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                    Upload new artwork, audio tracks, and metadata into the catalog.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ whiteSpace: 'nowrap', padding: '8px 16px', fontSize: 12 }}
                  onClick={() => {
                    setShowAddProductModal(false);
                    setEditRecord(null);
                    setShowForm(true);
                  }}
                >
                  + New Album
                </button>
              </div>

              {/* Option 2: Select from records */}
              <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                Select From Existing Albums ({records.length})
              </h4>

              {records.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No records found in library.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                  {records.map(r => {
                    const isPublished = Boolean(r.productEnabled || r.product_enabled);
                    return (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          border: '1px solid var(--border-subtle, #e5e3dc)',
                          borderRadius: 4,
                          background: isPublished ? 'rgba(42, 112, 64, 0.04)' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {r.artworkUrl ? (
                            <img src={r.artworkUrl} alt={r.title} style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 2 }} />
                          ) : (
                            <div style={{ width: 42, height: 42, background: '#e5e3dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>♫</div>
                          )}
                          <div>
                            <strong style={{ fontSize: 14, color: 'var(--text-primary)', display: 'block' }}>{r.title}</strong>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {r.genre} · {r.tracks?.length || 0} tracks
                              {isPublished ? ' · (Active in Store)' : ' · (Draft / Not Published)'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={isPublished ? 'btn-secondary' : 'btn-primary'}
                          style={{ padding: '6px 14px', fontSize: 12 }}
                          onClick={() => {
                            setShowAddProductModal(false);
                            setProductRecord(r);
                          }}
                        >
                          {isPublished ? 'Edit Product' : 'Add to Store'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal__footer" style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-ghost" onClick={() => setShowAddProductModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
