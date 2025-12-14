import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import apiService from '../../services/apiService';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Skeleton from '../../components/common/Skeleton';
import Button from '../../components/common/Button';
import useAuthStore from '../../store/useAuthStore';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ElectionResultsPage = () => {
  const { electionAddress } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [results, setResults] = useState(null);
  const [electionMetadata, setElectionMetadata] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadResults = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resultsRes, electionRes] = await Promise.all([
        apiService.getElectionResults(electionAddress),
        apiService.getElectionByContract(electionAddress)
      ]);

      if (resultsRes.success) {
        setResults(resultsRes);
      }

      if (electionRes.success && electionRes.election?.ipfsHash) {
        // Load metadata from IPFS
        try {
          const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${electionRes.election.ipfsHash}`;
          const metadataRes = await fetch(ipfsUrl);
          if (metadataRes.ok) {
            const metadata = await metadataRes.json();
            setElectionMetadata(metadata);
          }
        } catch (ipfsError) {
          // eslint-disable-next-line no-console
          console.warn('Failed to load IPFS metadata:', ipfsError);
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Load results error:', error);
      toast.error('Không thể tải kết quả');
    } finally {
      setIsLoading(false);
    }
  }, [electionAddress]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-64 w-full mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!results) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Không thể tải kết quả</p>
      </div>
    );
  }

  const chartData = results.results?.map((r, index) => ({
    name: r.name,
    votes: parseInt(r.voteCount),
    color: COLORS[index % COLORS.length]
  })) || [];

  const totalVotes = chartData.reduce((sum, item) => sum + item.votes, 0);

  return (
    <div className="p-6 space-y-6 animate-fadeIn">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            onClick={() => {
              // Navigate based on user role
              if (user?.role === 'CREATOR') {
                navigate('/dashboard/creator');
              } else {
                navigate('/dashboard/voter');
              }
            }}
            variant="outline"
            size="small"
            className="flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Quay lại Dashboard
          </Button>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          {electionMetadata?.title || 'Election Results'}
        </h1>
        <p className="text-gray-600 text-lg">
          {electionMetadata?.description || 'Kết quả bầu cử'}
        </p>
      </div>

      {results.winner && (
        <Card className="p-8 bg-gradient-to-r from-yellow-50 via-orange-50 to-amber-50 border-2 border-yellow-300 shadow-xl animate-slideUp">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">🏆</div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">Người thắng cuộc</h2>
            <p className="text-xl md:text-2xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">{results.winner.name}</p>
            <p className="text-gray-600 text-lg mb-4">{results.winner.party}</p>
            <div className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl shadow-lg">
              <p className="text-xl font-bold">
                {results.winner.voteCount} phiếu bầu
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card className="p-6 hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Phân bố phiếu bầu</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="votes"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Bar Chart */}
        <Card className="p-6 hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Số phiếu bầu theo ứng viên</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="votes" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Detailed Results Table */}
      <Card className="p-6 hover:shadow-xl transition-shadow duration-300">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Chi tiết kết quả</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gradient-to-r from-blue-600 to-purple-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Ứng viên</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Đảng</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Số phiếu</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Tỷ lệ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.results?.map((result, index) => (
                <tr key={index} className={`transition-colors hover:bg-gray-50 ${results.winner?.candidateId === result.candidateId ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">{result.name}</span>
                      {results.winner?.candidateId === result.candidateId && (
                        <Badge variant="success" className="ml-2 animate-pulse">Winner</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{result.party}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                    {result.voteCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-600">
                    {totalVotes > 0 ? ((parseInt(result.voteCount) / totalVotes) * 100).toFixed(2) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gradient-to-r from-gray-100 to-gray-200">
              <tr>
                <td colSpan="2" className="px-6 py-3 text-sm font-bold text-gray-900">Tổng cộng</td>
                <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{totalVotes}</td>
                <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ElectionResultsPage;

