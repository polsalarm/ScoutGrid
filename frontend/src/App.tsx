import { Layout } from './components/layout/Layout';
import { Marketplace } from './pages/Marketplace';
import { MyRoster } from './pages/MyRoster';
import { MyAchievements } from './pages/MyAchievements';
import { ToastContainer } from './components/ui/Toast';

function App() {
  return (
    <>
      <Layout>
        {(page) =>
          page === 'marketplace' ? <Marketplace /> : 
          page === 'roster' ? <MyRoster /> :
          <MyAchievements />
        }
      </Layout>
      <ToastContainer />
    </>
  );
}

export default App;
