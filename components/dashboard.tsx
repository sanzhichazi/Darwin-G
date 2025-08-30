"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Activity, DollarSign, TrendingUp, Users, Mail, MessageCircle, Store } from "lucide-react"

export function Dashboard() {
  return (
    <div className="p-6 border-b bg-white">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Agent Dashboard</h2>
        <p className="text-sm text-muted-foreground">Real-time overview of agent performance and operations</p>
      </div>

      {/* Agent Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+2</span> from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operating Costs</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$2,847</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600">+12%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Store Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$45,231</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+18%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$42,384</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+22%</span> ROI this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Marketing Agent</span>
                <Badge variant="secondary">Active</Badge>
              </div>
              <div className="text-sm text-muted-foreground">$1,240 cost</div>
            </div>
            <Progress value={85} className="h-2" />
            <div className="text-xs text-muted-foreground">85% efficiency • 24 campaigns active</div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium">Sales Agent</span>
                <Badge variant="secondary">Active</Badge>
              </div>
              <div className="text-sm text-muted-foreground">$890 cost</div>
            </div>
            <Progress value={92} className="h-2" />
            <div className="text-xs text-muted-foreground">92% efficiency • 156 orders processed</div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-sm font-medium">Customer Service Agent</span>
                <Badge variant="secondary">Active</Badge>
              </div>
              <div className="text-sm text-muted-foreground">$567 cost</div>
            </div>
            <Progress value={78} className="h-2" />
            <div className="text-xs text-muted-foreground">78% efficiency • 89 tickets resolved</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start space-x-3">
              <Mail className="h-4 w-4 text-blue-500 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Marketing Agent sent 1,247 emails</p>
                <p className="text-xs text-muted-foreground">Target: High-value customers • 2 minutes ago</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <MessageCircle className="h-4 w-4 text-green-500 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Auto-posted on social media</p>
                <p className="text-xs text-muted-foreground">New product launch campaign • 15 minutes ago</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Store className="h-4 w-4 text-purple-500 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Store optimization completed</p>
                <p className="text-xs text-muted-foreground">Darwin Digital Flagship • 1 hour ago</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Users className="h-4 w-4 text-orange-500 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Customer segmentation updated</p>
                <p className="text-xs text-muted-foreground">2,847 customers analyzed • 2 hours ago</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
