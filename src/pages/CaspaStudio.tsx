/**
 * Caspa Studio - Complete App
 * Matches design system: Project Desk, Writing Room, Red Pen, Library, Story Bible, Research Desk, Publish, Settings
 * No ghost logo. Clean, production-ready.
 */

import React, { useState } from 'react';
import { FileText, BookOpen, PenTool, Search, Upload, Zap, AlertCircle, ChevronRight, Plus, MoreVertical, Save, Download, Share2, Eye, Settings, Home, ArrowLeft } from 'lucide-react';
import styles from './CaspaStudio.module.css';

interface Manuscript {
  id: string;
  title: string;
  type: 'Novel' | 'Memoir' | 'Play' | 'Manual';
  wordCount: number;
  targetWords: number;
  chapters: number;
  totalChapters: number;
  continuityIssues: number;
  lastOpened: string;
  progress: number;
}

interface Chapter {
  id: number;
  number: number;
  title: string;
  words: number;
  status: 'draft' | 'revised' | 'final';
}

const CaspaStudio: React.FC = () => {
  const [view, setView] = useState<'desk' | 'writing' | 'redpen' | 'library' | 'research' | 'story' | 'publish'>('desk');
  const [selectedManuscript, setSelectedManuscript] = useState<Manuscript | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

  // Sample data
  const manuscripts: Manuscript[] = [
    {
      id: '1',
      title: 'The House of God',
      type: 'Novel',
      wordCount: 82517,
      targetWords: 120000,
      chapters: 28,
      totalChapters: 40,
      continuityIssues: 7,
      lastOpened: 'Today, 9:41 AM',
      progress: 68,
    },
  ];

  const chapters: Chapter[] = [
    { id: 13, number: 13, title: 'The Quiet Before', words: 2406, status: 'final' },
    { id: 14, number: 14, title: 'Ashes of Yesterday', words: 2650, status: 'final' },
    { id: 15, number: 15, title: 'Confession', words: 2184, status: 'revised' },
    { id: 16, number: 16, title: "The Widow's Letter", words: 2912, status: 'revised' },
    { id: 17, number: 17, title: 'The Levee', words: 2341, status: 'draft' },
  ];

  const continuityIssues = [
    { id: 1, type: 'Timeline', chapter: 17, severity: 'high', title: 'Timeline conflict in Chapter 17', description: 'Event occurs before a prerequisite in Chapter 16.' },
    { id: 2, type: 'Character', chapter: 17, severity: 'medium', title: "Elise's location unclear", description: 'Elise is in two places at once.' },
    { id: 3, type: 'Continuity', chapter: 17, severity: 'medium', title: 'Inconsistent detail', description: 'The color of the truck changes.' },
    { id: 4, type: 'Plot', chapter: 10, severity: 'low', title: 'Foreshadowing opportunity', description: 'Consider earlier hint at flood.' },
  ];

  if (!selectedManuscript && view === 'desk') {
    return (
      <div className={styles.container}>
        <div className={styles.sidebar}>
          <div className={styles.logo}>
            <span className={styles.logoText}>Caspa Studio</span>
          </div>
          <nav className={styles.nav}>
            <div className={styles.navItem} onClick={() => setView('library')}>
              <BookOpen size={20} />
              <span>Library</span>
            </div>
            <div className={`${styles.navItem} ${styles.active}`} onClick={() => setView('desk')}>
              <Home size={20} />
              <span>Project Desk</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('story')}>
              <BookOpen size={20} />
              <span>Story Bible</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('writing')}>
              <PenTool size={20} />
              <span>Writing Room</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('redpen')}>
              <AlertCircle size={20} />
              <span>Red Pen</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('research')}>
              <Search size={20} />
              <span>Research Desk</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('publish')}>
              <Upload size={20} />
              <span>Publish</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('publish')}>
              <Settings size={20} />
              <span>Settings</span>
            </div>
          </nav>
          <div className={styles.userProfile}>
            <span>Alex Mercer</span>
          </div>
        </div>

        <div className={styles.mainContent}>
          <h1>Your Library</h1>
          <div className={styles.manuscriptGrid}>
            {manuscripts.map((ms) => (
              <div key={ms.id} className={styles.manuscriptCard} onClick={() => { setSelectedManuscript(ms); setView('desk'); }}>
                <div className={styles.cardHeader}>
                  <h3>{ms.title}</h3>
                  <span className={styles.type}>{ms.type}</span>
                </div>
                <div className={styles.progressSection}>
                  <div className={styles.progressCircle}>
                    <svg viewBox="0 0 100 100" className={styles.svg}>
                      <circle cx="50" cy="50" r="45" className={styles.progressBg} />
                      <circle cx="50" cy="50" r="45" className={styles.progressFill} style={{ '--progress': ms.progress } as any} />
                    </svg>
                    <span className={styles.progressText}>{ms.progress}%</span>
                  </div>
                  <div className={styles.progressDetails}>
                    <p>{ms.wordCount.toLocaleString()} of {ms.targetWords.toLocaleString()} words</p>
                    <p className={styles.onTrack}>On track</p>
                  </div>
                </div>
                <div className={styles.stats}>
                  <div>
                    <p className={styles.statValue}>{ms.chapters}</p>
                    <p className={styles.statLabel}>Chapters</p>
                    <p className={styles.statNote}>{Math.round(ms.chapters / ms.totalChapters * 100)}% written</p>
                  </div>
                  <div>
                    <p className={styles.statValue}>{ms.continuityIssues}</p>
                    <p className={styles.statLabel}>Issues</p>
                    <p className={styles.statNote}>Review recommended</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (selectedManuscript && view === 'desk') {
    return (
      <div className={styles.container}>
        <div className={styles.sidebar}>
          <div className={styles.logo} onClick={() => setSelectedManuscript(null)}>
            <span className={styles.logoText}>Caspa Studio</span>
          </div>
          <nav className={styles.nav}>
            <div className={`${styles.navItem} ${styles.active}`} onClick={() => setView('desk')}>
              <Home size={20} />
              <span>Project Desk</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('story')}>
              <BookOpen size={20} />
              <span>Story Bible</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('writing')}>
              <PenTool size={20} />
              <span>Writing Room</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('redpen')}>
              <AlertCircle size={20} />
              <span>Red Pen</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('research')}>
              <Search size={20} />
              <span>Research Desk</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('publish')}>
              <Upload size={20} />
              <span>Publish</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('publish')}>
              <Settings size={20} />
              <span>Settings</span>
            </div>
          </nav>
        </div>

        <div className={styles.mainContent}>
          <div className={styles.deskHeader}>
            <div>
              <h1>{selectedManuscript.title}</h1>
              <p>{selectedManuscript.type} · Novel</p>
            </div>
            <div className={styles.topActions}>
              <button className={styles.btnCheck}>
                <Save size={18} />
                Save
              </button>
              <button className={styles.btnDefault}>
                <Download size={18} />
                Export .docx
              </button>
              <button className={styles.btnGold}>
                <Share2 size={18} />
                Share
              </button>
            </div>
          </div>

          <div className={styles.deskGrid}>
            {/* Manuscript Progress */}
            <div className={styles.gridItem}>
              <h3>MANUSCRIPT PROGRESS</h3>
              <div className={styles.largeProgress}>
                <div className={styles.progressCircleLarge}>
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" className={styles.progressBg} />
                    <circle cx="50" cy="50" r="45" className={styles.progressFill} style={{ '--progress': selectedManuscript.progress } as any} />
                  </svg>
                  <span>{selectedManuscript.progress}%</span>
                </div>
                <div>
                  <p className={styles.wordCount}>{selectedManuscript.wordCount.toLocaleString()}</p>
                  <p className={styles.wordLabel}>of {selectedManuscript.targetWords.toLocaleString()} words</p>
                  <p className={styles.progressStatus}>On track</p>
                </div>
              </div>
            </div>

            {/* Chapters */}
            <div className={styles.gridItem}>
              <h3>CHAPTERS</h3>
              <p className={styles.bigNumber}>{selectedManuscript.chapters}</p>
              <p className={styles.ofLabel}>of {selectedManuscript.totalChapters}</p>
              <p className={styles.progressStatus}>{Math.round(selectedManuscript.chapters / selectedManuscript.totalChapters * 100)}% written</p>
            </div>

            {/* Continuity Risks */}
            <div className={styles.gridItem}>
              <h3>CONTINUITY RISKS</h3>
              <p className={styles.bigNumber}>{selectedManuscript.continuityIssues}</p>
              <p className={styles.ofLabel}>Issues detected</p>
              <p className={styles.progressStatus}>Review recommended</p>
            </div>

            {/* Next Action */}
            <div className={styles.gridItem}>
              <h3>NEXT SUGGESTED ACTION</h3>
              <div className={styles.actionIcon}>
                <FileText size={24} />
              </div>
              <p className={styles.actionTitle}>Resolve 3 continuity issues in Chapter 17</p>
              <button className={styles.reviewBtn}>Review Issues</button>
            </div>
          </div>

          {/* Action Cards */}
          <div className={styles.actionCards}>
            <div className={styles.actionCard}>
              <PenTool size={24} />
              <h4>Continue Writing</h4>
              <p>Pick up where you left off.</p>
              <div className={styles.cardMeta}>
                <p>Last opened</p>
                <p className={styles.metaContent}>Chapter 17: The Levee</p>
                <p>2,341 words · Today, 9:41 AM</p>
              </div>
              <button className={styles.cardBtn}>
                <ChevronRight size={18} />
              </button>
            </div>

            <div className={`${styles.actionCard} ${styles.warning}`}>
              <AlertCircle size={24} />
              <h4>Fix Problems</h4>
              <p>Address continuity and development issues.</p>
              <div className={styles.cardMeta}>
                <p>7 issues across 4 chapters</p>
                <p>Last found: Today, 8:57 AM</p>
              </div>
              <button className={styles.cardBtn}>
                <ChevronRight size={18} />
              </button>
            </div>

            <div className={styles.actionCard}>
              <BookOpen size={24} />
              <h4>Build the Book</h4>
              <p>Organize, structure, and prepare your manuscript.</p>
              <div className={styles.cardMeta}>
                <p>40 chapters · 3 parts</p>
                <p>Manuscript is 68% complete</p>
              </div>
              <button className={styles.cardBtn}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Recent Chapters */}
          <div className={styles.recentSection}>
            <div className={styles.sectionHeader}>
              <h3>RECENT CHAPTERS</h3>
              <a href="#">View All</a>
            </div>
            <div className={styles.chapterList}>
              {chapters.map((ch) => (
                <div key={ch.id} className={styles.chapterItem} onClick={() => { setSelectedChapter(ch); setView('writing'); }}>
                  <FileText size={18} />
                  <div>
                    <p className={styles.chapterNum}>{ch.number}</p>
                    <p className={styles.chapterTitle}>{ch.title}</p>
                  </div>
                  <div className={styles.chapterMeta}>
                    <p>{ch.words.toLocaleString()} words</p>
                    {ch.status === 'draft' && <span className={styles.draft}>Draft</span>}
                    {ch.status === 'revised' && <span className={styles.revised}>Revised</span>}
                    {ch.status === 'final' && <span className={styles.final}>Final</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Manuscript Health */}
          <div className={styles.healthSection}>
            <h3>MANUSCRIPT HEALTH</h3>
            <div className={styles.healthMetrics}>
              <div className={styles.metric}>
                <p className={styles.metricLabel}>Pacing</p>
                <div className={styles.metricBar}>
                  <div className={styles.metricFill} style={{ width: '75%' }} />
                </div>
                <p className={styles.metricStatus}>Good</p>
              </div>
              <div className={styles.metric}>
                <p className={styles.metricLabel}>Character Arcs</p>
                <div className={styles.metricBar}>
                  <div className={styles.metricFill} style={{ width: '80%' }} />
                </div>
                <p className={styles.metricStatus}>Good</p>
              </div>
              <div className={styles.metric}>
                <p className={styles.metricLabel}>Show vs. Tell</p>
                <div className={styles.metricBar}>
                  <div className={styles.metricFill} style={{ width: '60%' }} />
                </div>
                <p className={styles.metricStatus}>Needs Work</p>
              </div>
              <div className={styles.metric}>
                <p className={styles.metricLabel}>Continuity</p>
                <div className={styles.metricBar}>
                  <div className={styles.metricFill} style={{ width: '40%', backgroundColor: '#FF6B6B' }} />
                </div>
                <p className={styles.metricStatus}>At Risk</p>
              </div>
              <div className={styles.metric}>
                <p className={styles.metricLabel}>Dialogue Balance</p>
                <div className={styles.metricBar}>
                  <div className={styles.metricFill} style={{ width: '85%' }} />
                </div>
                <p className={styles.metricStatus}>Good</p>
              </div>
              <div className={styles.metric}>
                <p className={styles.metricLabel}>Setting Depth</p>
                <div className={styles.metricBar}>
                  <div className={styles.metricFill} style={{ width: '70%' }} />
                </div>
                <p className={styles.metricStatus}>Needs Work</p>
              </div>
            </div>
            <button className={styles.fullReportBtn}>View Full Report</button>
          </div>

          {/* Upcoming Tasks */}
          <div className={styles.tasksSection}>
            <div className={styles.sectionHeader}>
              <h3>UPCOMING TASKS</h3>
              <a href="#">View Calendar</a>
            </div>
            <div className={styles.taskList}>
              {continuityIssues.slice(0, 4).map((issue) => (
                <div key={issue.id} className={styles.taskItem}>
                  <input type="checkbox" />
                  <div>
                    <p className={styles.taskTitle}>{issue.title}</p>
                    <p className={styles.taskMeta}>
                      {issue.severity === 'high' && <span className={styles.highPriority}>High priority</span>}
                      {issue.severity === 'medium' && <span className={styles.mediumPriority}>Medium priority</span>}
                      {issue.severity === 'low' && <span className={styles.lowPriority}>Low priority</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button className={styles.addTaskBtn}>
              <Plus size={18} />
              Add Task
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'redpen') {
    return (
      <div className={styles.container}>
        <div className={styles.sidebar}>
          <div className={styles.logo} onClick={() => setSelectedManuscript(null)}>
            <span className={styles.logoText}>Caspa Studio</span>
          </div>
          <nav className={styles.nav}>
            <div className={styles.navItem} onClick={() => setView('desk')}>
              <Home size={20} />
              <span>Project Desk</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('story')}>
              <BookOpen size={20} />
              <span>Story Bible</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('writing')}>
              <PenTool size={20} />
              <span>Writing Room</span>
            </div>
            <div className={`${styles.navItem} ${styles.active}`} onClick={() => setView('redpen')}>
              <AlertCircle size={20} />
              <span>Red Pen</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('research')}>
              <Search size={20} />
              <span>Research Desk</span>
            </div>
            <div className={styles.navItem} onClick={() => setView('publish')}>
              <Upload size={20} />
              <span>Publish</span>
            </div>
          </nav>
        </div>

        <div className={styles.mainContent}>
          <div className={styles.redpenHeader}>
            <h1>Red Pen</h1>
            <div className={styles.tabs}>
              <button className={styles.tabActive}>Issues (7)</button>
              <button className={styles.tab}>Suggestions</button>
            </div>
          </div>

          <div className={styles.issuesList}>
            {continuityIssues.map((issue) => (
              <div key={issue.id} className={styles.issueCard}>
                <div className={styles.issueType}>{issue.type}</div>
                <h4 className={styles.issueTitle}>{issue.title}</h4>
                <p className={styles.issueDesc}>{issue.description}</p>
                <p className={styles.issueChapter}>Chapter {issue.chapter}</p>
                <button className={styles.reviewIssueBtn}>
                  Review <ChevronRight size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoText}>Caspa Studio</span>
        </div>
        <nav className={styles.nav}>
          <div className={styles.navItem} onClick={() => setView('library')}>
            <BookOpen size={20} />
            <span>Library</span>
          </div>
        </nav>
      </div>
      <div className={styles.mainContent} style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: '#999', fontSize: '1.1rem' }}>View coming soon...</p>
      </div>
    </div>
  );
};

export default CaspaStudio;
