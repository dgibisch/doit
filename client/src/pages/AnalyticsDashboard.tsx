import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  getUserActivityMetrics, 
  getMonthlyActivityData, 
  getCategoryDistribution, 
  getRecentActivity,
  type UserActivityMetrics,
  type MonthlyActivityData,
  type CategoryDistribution,
  type RecentActivity
} from '@/lib/analytics';
import { formatDate } from '@/lib/utils';

const COLORS = ['#FF6B6B', '#4ECDC4', '#F7B801', '#7765E3', '#3D348B'];

const AnalyticsDashboard = () => {
  // Current user ID - This would come from your auth context
  // For testing, we'll use a placeholder ID
  const userId = "current-user-id";

  // Sample data for demonstration
  const sampleMonthlyData = [
    { month: 'Jan', completed: 4, posted: 2 },
    { month: 'Feb', completed: 6, posted: 3 },
    { month: 'Mar', completed: 8, posted: 5 },
    { month: 'Apr', completed: 10, posted: 7 },
    { month: 'May', completed: 12, posted: 4 },
    { month: 'Jun', completed: 11, posted: 8 },
  ];

  const sampleCategoryData = [
    { name: 'Home Repair', value: 35 },
    { name: 'Delivery', value: 25 },
    { name: 'Errands', value: 20 },
    { name: 'Technology', value: 15 },
    { name: 'Other', value: 5 },
  ];

  const [metrics, setMetrics] = useState<UserActivityMetrics>({
    tasksCompleted: 42,
    tasksPosted: 24,
    averageRating: 4.7,
    totalEarnings: 865,
  });
  
  const [monthlyData, setMonthlyData] = useState<MonthlyActivityData[]>(sampleMonthlyData);
  const [categoryData, setCategoryData] = useState<CategoryDistribution[]>(sampleCategoryData);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([
    {
      type: 'completed',
      title: 'Completed: House Cleaning Task',
      date: new Date(Date.now() - 86400000), // yesterday
      additionalInfo: '€45'
    },
    {
      type: 'posted',
      title: 'Posted: Furniture Assembly',
      date: new Date(Date.now() - 172800000), // 2 days ago
    },
    {
      type: 'applied',
      title: 'Applied: Dog Walking',
      date: new Date(Date.now() - 259200000), // 3 days ago
      additionalInfo: '€20'
    },
    {
      type: 'rating',
      title: 'Received 5★ rating',
      date: new Date(Date.now() - 432000000), // 5 days ago
    }
  ]);
  const [loading, setLoading] = useState(false); // Set to false to skip loading stage
  
  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        // In a real implementation, this would fetch real data
        // For now, we'll just use the sample data
        console.log("Would normally fetch real data from Firebase here");
        
        /* 
        const [metricsData, monthlyActivityData, categoryDistData, recentActivityData] = await Promise.all([
          getUserActivityMetrics(userId),
          getMonthlyActivityData(userId),
          getCategoryDistribution(userId),
          getRecentActivity(userId)
        ]);
        
        setMetrics(metricsData);
        setMonthlyData(monthlyActivityData);
        setCategoryData(categoryDistData);
        setRecentActivities(recentActivityData);
        */
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    // Uncomment this to use real data when Firebase is properly set up
    // loadDashboardData();
  }, [userId]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Activity Dashboard</h1>
        <p className="text-gray-500">Performance metrics and task analytics</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-lg">Tasks Completed</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-bold">{metrics.tasksCompleted}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-lg">Tasks Posted</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-bold">{metrics.tasksPosted}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-lg">Avg. Rating</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-bold">{metrics.averageRating}</p>
            <div className="text-yellow-400 text-xs mt-1">
              {'★'.repeat(Math.round(metrics.averageRating))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-lg">Total Earnings</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-bold">€{metrics.totalEarnings}</p>
          </CardContent>
        </Card>
      </div>
      
      <Separator />
      
      <div>
        <h2 className="text-xl font-bold mb-4">Activity Over Time</h2>
        <div className="h-80 bg-white p-4 rounded-lg shadow">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="completed" name="Tasks Completed" fill="#4ECDC4" />
              <Bar dataKey="posted" name="Tasks Posted" fill="#FF6B6B" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-bold mb-4">Category Distribution</h2>
          <div className="h-80 bg-white p-4 rounded-lg shadow">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name: string, percent: number }) => 
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-gray-500">No category data available</p>
              </div>
            )}
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity, index) => {
                // Determine the color and icon based on activity type
                let color = "bg-gray-500";
                if (activity.type === 'completed') color = "bg-green-500";
                if (activity.type === 'posted') color = "bg-blue-500";
                if (activity.type === 'applied') color = "bg-yellow-500";
                if (activity.type === 'rating') color = "bg-purple-500";
                
                return (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full ${color} mr-2`}></div>
                        <div>
                          <p className="font-medium">{activity.title}</p>
                          <p className="text-sm text-gray-500">{formatDate(activity.date)}</p>
                          {activity.additionalInfo && (
                            <p className="text-xs text-gray-400 mt-1">{activity.additionalInfo}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="p-4 bg-white rounded-lg shadow">
                <p className="text-gray-500 text-center">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;