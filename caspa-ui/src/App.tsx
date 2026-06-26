import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { RequireAdmin } from './components/RequireAdmin';
import { ToastProvider } from './components/Toast';
import Dashboard from './pages/Dashboard';
import CommandCentre from './pages/CommandCentre';
import NaturalCommand from './pages/NaturalCommand';
import CasperFreestyle from './pages/CasperFreestyle';
import ForgeIntake from './pages/ForgeIntake';
import ProductPlan from './pages/ProductPlan';
import Sources from './pages/Sources';
import MusicPromptLab from './pages/MusicPromptLab';
import DocumentStudio from './pages/DocumentStudio';
import PublishConfidence from './pages/PublishConfidence';
import Outputs from './pages/Outputs';
import OutputDetail from './pages/OutputDetail';
import ProjectBible from './pages/ProjectBible';
import ProjectOverview from './pages/ProjectOverview';
import ChapterEditor from './pages/ChapterEditor';
import Characters from './pages/Characters';
import PlotBoard from './pages/PlotBoard';
import Research from './pages/Research';
import ShowFactory from './pages/ShowFactory';
import MusicLab from './pages/MusicLab';
import Production from './pages/Production';
import ShowInABox from './pages/ShowInABox';
import Publish from './pages/Publish';
import Settings from './pages/Settings';
import Wonder from './pages/Wonder';
import Quality from './pages/Quality';
import Taste from './pages/Taste';
import Audience from './pages/Audience';
import Showstopper from './pages/Showstopper';
import Rehearsal from './pages/Rehearsal';
import Producer from './pages/Producer';
import Localise from './pages/Localise';
import Visuals from './pages/Visuals';
import Awards from './pages/Awards';
import GoldPipeline from './pages/GoldPipeline';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminUsers from './pages/AdminUsers';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<AuthGuard />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/home" replace />} />
              <Route path="home" element={<CommandCentre />} />
              <Route path="command" element={<NaturalCommand />} />
              <Route path="casper" element={<CasperFreestyle />} />
              <Route path="projects" element={<Dashboard />} />
              <Route path="projects/:id" element={<ProjectOverview />} />
              <Route path="projects/:id/characters" element={<Characters />} />
              <Route path="projects/:id/plot" element={<PlotBoard />} />
              <Route path="projects/:id/research" element={<Research />} />
              <Route path="forge" element={<ForgeIntake />} />
              <Route path="product-plan" element={<ProductPlan />} />
              <Route path="sources" element={<Sources />} />
              <Route path="music-prompt" element={<MusicPromptLab />} />
              <Route path="documents" element={<DocumentStudio />} />
              <Route path="confidence" element={<PublishConfidence />} />
              <Route path="outputs" element={<Outputs />} />
              <Route path="outputs/:id" element={<OutputDetail />} />
              <Route path="projects/:id/bible" element={<ProjectBible />} />
              <Route path="show-factory" element={<ShowFactory />} />
              <Route path="music-lab" element={<MusicLab />} />
              <Route path="production" element={<Production />} />
              <Route path="show-in-a-box" element={<ShowInABox />} />
              <Route path="publish" element={<Publish />} />
              <Route path="wonder" element={<Wonder />} />
              <Route path="quality" element={<Quality />} />
              <Route path="taste" element={<Taste />} />
              <Route path="audience" element={<Audience />} />
              <Route path="showstopper" element={<Showstopper />} />
              <Route path="rehearsal" element={<Rehearsal />} />
              <Route path="producer" element={<Producer />} />
              <Route path="localise" element={<Localise />} />
              <Route path="visuals" element={<Visuals />} />
              <Route path="awards" element={<Awards />} />
              <Route path="gold" element={<GoldPipeline />} />
              <Route path="settings" element={<Settings />} />
              <Route element={<RequireAdmin />}>
                <Route path="admin/users" element={<AdminUsers />} />
              </Route>
            </Route>
            <Route path="projects/:id/chapters/:chapterId" element={<ChapterEditor />} />
          </Route>
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
