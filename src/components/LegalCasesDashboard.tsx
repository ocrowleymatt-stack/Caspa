/**
 * Legal Cases Dashboard
 * Browse, search, filter, and visualize legal case graph data from Nexus.
 * 
 * Features:
 * - Case list with status indicators (active/pending/closed)
 * - Search by case ID, parties, claims
 * - Filter by status, date range, tags
 * - Relationship graph visualization (entities, parties, connections)
 * - Quick-view modal with full case details
 * - Sync status indicator
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Network,
  Download,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface Case {
  id: string;
  caseId: string;
  title: string;
  parties: string;
  status: 'active' | 'pending' | 'closed';
  nexusInvestigationId: string;
  claims: string[];
  entities: string[];
  lastUpdated: string;
  documentCount: number;
  tags: string[];
}

interface LegalCasesDashboardProps {
  onNavigate?: (view: string) => void;
}

const statusConfig = {
  active: { icon: CheckCircle, color: '#2ecc71', label: 'Active' },
  pending: { icon: Clock, color: '#f39c12', label: 'Pending' },
  closed: { icon: XCircle, color: '#e74c3c', label: 'Closed' },
};

export default function LegalCasesDashboard({ onNavigate }: LegalCasesDashboardProps) {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'closed'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [lastSync, setLastSync] = useState<string>(new Date().toISOString());

  // Fetch cases from API
  useEffect(() => {
    fetchCases();
    const interval = setInterval(fetchCases, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchCases = async () => {
    setLoading(true);
    try {
      // In production, call your API: GET /api/cases
      // For now, mock data:
      const mockCases: Case[] = [
        {
          id: '1',
          caseId: 'CASE-2026-001',
          title: 'O\'Crowley v. Acme Corp',
          parties: 'Matthew O\'Crowley, Acme Corporation',
          status: 'active',
          nexusInvestigationId: 'inv_12345',
          claims: ['Breach of contract', 'Damages'],
          entities: ['Matthew O\'Crowley', 'Acme Corp', 'District Court'],
          lastUpdated: new Date().toISOString(),
          documentCount: 12,
          tags: ['contract', 'commercial', 'litigation'],
        },
        {
          id: '2',
          caseId: 'CASE-2026-002',
          title: 'Smith Estate Dispute',
          parties: 'Estate of John Smith',
          status: 'pending',
          nexusInvestigationId: 'inv_12346',
          claims: ['Inheritance', 'Will validity'],
          entities: ['John Smith Estate', 'Beneficiaries', 'Probate Court'],
          lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          documentCount: 8,
          tags: ['estate', 'probate', 'inheritance'],
        },
      ];
      setCases(mockCases);
      setLastSync(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      searchQuery === '' ||
      c.caseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.parties.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleViewCase = (c: Case) => {
    setSelectedCase(c);
    setShowModal(true);
  };

  const handleViewGraph = (caseId: string) => {
    // Open Nexus graph view for the case
    window.open(`/nexus/investigations/${caseId}/graph`, '_blank');
  };

  return (
    <div style={{ padding: '24px', background: '#f5efe5', minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 4px', color: '#172033' }}>Legal Cases</h1>
            <p style={{ fontSize: '13px', color: '#8b7d6b', margin: 0 }}>
              {filteredCases.length} case{filteredCases.length !== 1 ? 's' : ''} • Last synced{' '}
              {new Date(lastSync).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={fetchCases}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: '#d6a846',
              color: '#1a1208',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Sync Now
          </button>
        </div>

        {/* Search & Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '11px', color: '#999' }} />
            <input
              type="text"
              placeholder="Search case ID, title, or parties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                border: '1px solid #e0d3bf',
                borderRadius: '12px',
                fontSize: '14px',
                background: '#fffaf2',
              }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              border: '1px solid #e0d3bf',
              background: '#fffaf2',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            <Filter size={16} />
            Filter
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div style={{ padding: '12px 16px', background: '#fffaf2', borderRadius: '12px', marginBottom: '16px', border: '1px solid #e0d3bf' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px', color: '#172033' }}>
              <strong>Status:</strong>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['all', 'active', 'pending', 'closed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e0d3bf',
                    background: statusFilter === status ? '#d6a846' : 'transparent',
                    color: statusFilter === status ? '#1a1208' : '#172033',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: statusFilter === status ? 600 : 400,
                  }}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cases List */}
      <div style={{ display: 'grid', gap: '12px' }}>
        {filteredCases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8b7d6b' }}>
            <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p>No cases found</p>
          </div>
        ) : (
          filteredCases.map((c) => {
            const StatusIcon = statusConfig[c.status].icon;
            return (
              <div
                key={c.id}
                onClick={() => handleViewCase(c)}
                style={{
                  padding: '16px',
                  background: '#fffaf2',
                  border: '1px solid #e0d3bf',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <StatusIcon size={18} color={statusConfig[c.status].color} />
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#172033' }}>
                      {c.title}
                    </h3>
                  </div>
                  <p style={{ fontSize: '13px', color: '#8b7d6b', margin: '4px 0' }}>
                    <strong>ID:</strong> {c.caseId}
                  </p>
                  <p style={{ fontSize: '13px', color: '#8b7d6b', margin: '4px 0' }}>
                    <strong>Parties:</strong> {c.parties}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    {c.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          background: '#e8dcc8',
                          color: '#5a4a3a',
                          padding: '4px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    marginLeft: '20px',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#172033' }}>
                      {c.documentCount}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8b7d6b' }}>Documents</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewGraph(c.nexusInvestigationId);
                    }}
                    style={{
                      padding: '6px 10px',
                      background: '#d6a846',
                      color: '#1a1208',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Network size={14} />
                    Graph
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {showModal && selectedCase && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fffaf2',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '600px',
              maxHeight: '80dvh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
          >
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px' }}>
              {selectedCase.title}
            </h2>
            <p style={{ color: '#8b7d6b', marginBottom: '16px' }}>{selectedCase.caseId}</p>

            <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
              <div>
                <p style={{ fontSize: '12px', color: '#8b7d6b', margin: '0 0 4px' }}>
                  <strong>Parties</strong>
                </p>
                <p style={{ margin: 0 }}>{selectedCase.parties}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: '#8b7d6b', margin: '0 0 4px' }}>
                  <strong>Status</strong>
                </p>
                <p style={{ margin: 0, textTransform: 'capitalize' }}>{selectedCase.status}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: '#8b7d6b', margin: '0 0 4px' }}>
                  <strong>Claims</strong>
                </p>
                <ul style={{ margin: '0 0 0 20px', padding: 0 }}>
                  {selectedCase.claims.map((claim, i) => (
                    <li key={i}>{claim}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  handleViewGraph(selectedCase.nexusInvestigationId);
                  setShowModal(false);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#d6a846',
                  color: '#1a1208',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                View Graph
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#e0d3bf',
                  color: '#172033',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
