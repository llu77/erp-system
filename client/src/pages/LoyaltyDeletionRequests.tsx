import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { Trash2, CheckCircle, XCircle, Clock, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';

export default function LoyaltyDeletionRequests() {
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  const utils = trpc.useUtils();

  // جلب البيانات
  const { data: pendingRequests, isLoading: pendingLoading } = trpc.loyalty.pendingDeletionRequests.useQuery();
  const { data: allRequests, isLoading: allLoading } = trpc.loyalty.allDeletionRequests.useQuery({});
  const { data: stats } = trpc.loyalty.deletionRequestsStats.useQuery();

  // الموافقة على طلب الحذف
  const approveMutation = trpc.loyalty.approveDeletionRequest.useMutation({
    onSuccess: () => {
      toast.success('تمت الموافقة على طلب الحذف وتم حذف الزيارة');
      setShowApproveDialog(false);
      setAdminNotes('');
      setSelectedRequest(null);
      utils.loyalty.pendingDeletionRequests.invalidate();
      utils.loyalty.allDeletionRequests.invalidate();
      utils.loyalty.deletionRequestsStats.invalidate();
      utils.loyalty.branchVisits.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'فشل الموافقة على الطلب');
    },
  });

  // رفض طلب الحذف
  const rejectMutation = trpc.loyalty.rejectDeletionRequest.useMutation({
    onSuccess: () => {
      toast.success('تم رفض طلب الحذف');
      setShowRejectDialog(false);
      setAdminNotes('');
      setSelectedRequest(null);
      utils.loyalty.pendingDeletionRequests.invalidate();
      utils.loyalty.allDeletionRequests.invalidate();
      utils.loyalty.deletionRequestsStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'فشل رفض الطلب');
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="h-3 w-3 ml-1" />معلق</Badge>;
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 ml-1" />تمت الموافقة</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 ml-1" />مرفوض</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openApproveDialog = (request: any) => {
    setSelectedRequest(request);
    setShowApproveDialog(true);
  };

  const openRejectDialog = (request: any) => {
    setSelectedRequest(request);
    setShowRejectDialog(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/loyalty">
                <Button variant="ghost" size="sm">
                  <ArrowRight className="h-4 w-4 ml-1" />
                  العودة لبرنامج الولاء
                </Button>
              </Link>
            </div>
            <h1 className="text-2xl font-bold">طلبات حذف الزيارات</h1>
            <p className="text-muted-foreground">إدارة طلبات حذف زيارات برنامج الولاء</p>
          </div>
        </div>

        {/* إحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الطلبات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-700">طلبات معلقة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-700">{stats?.pending || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700">تمت الموافقة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{stats?.approved || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700">مرفوضة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">{stats?.rejected || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              معلقة
              {stats?.pending ? <Badge variant="secondary" className="mr-1">{stats.pending}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Trash2 className="h-4 w-4" />
              جميع الطلبات
            </TabsTrigger>
          </TabsList>

          {/* الطلبات المعلقة */}
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>طلبات الحذف المعلقة</CardTitle>
                <CardDescription>طلبات تحتاج موافقتك</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>العميل</TableHead>
                      <TableHead>رقم الجوال</TableHead>
                      <TableHead>الخدمة</TableHead>
                      <TableHead>تاريخ الزيارة</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>سبب الحذف</TableHead>
                      <TableHead>مقدم الطلب</TableHead>
                      <TableHead>تاريخ الطلب</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : !pendingRequests?.length ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          لا توجد طلبات حذف معلقة
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingRequests?.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.customerName}</TableCell>
                          <TableCell dir="ltr">{request.customerPhone}</TableCell>
                          <TableCell>{request.serviceType || '-'}</TableCell>
                          <TableCell>
                            {request.visitDate ? new Date(request.visitDate).toLocaleDateString('ar-SA') : '-'}
                          </TableCell>
                          <TableCell>{request.branchName || '-'}</TableCell>
                          <TableCell className="max-w-xs truncate" title={request.deletionReason}>
                            {request.deletionReason}
                          </TableCell>
                          <TableCell>{request.requestedByName || '-'}</TableCell>
                          <TableCell>
                            {new Date(request.requestedAt).toLocaleDateString('ar-SA')}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-green-50 text-green-700 hover:bg-green-100"
                                onClick={() => openApproveDialog(request)}
                              >
                                <CheckCircle className="h-4 w-4 ml-1" />
                                موافقة
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-red-50 text-red-700 hover:bg-red-100"
                                onClick={() => openRejectDialog(request)}
                              >
                                <XCircle className="h-4 w-4 ml-1" />
                                رفض
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* جميع الطلبات */}
          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>سجل جميع الطلبات</CardTitle>
                <CardDescription>جميع طلبات الحذف السابقة</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>العميل</TableHead>
                      <TableHead>رقم الجوال</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>سبب الحذف</TableHead>
                      <TableHead>مقدم الطلب</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>معالج بواسطة</TableHead>
                      <TableHead>ملاحظات الأدمن</TableHead>
                      <TableHead>تاريخ المعالجة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : !allRequests?.length ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          لا توجد طلبات حذف
                        </TableCell>
                      </TableRow>
                    ) : (
                      allRequests?.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.customerName}</TableCell>
                          <TableCell dir="ltr">{request.customerPhone}</TableCell>
                          <TableCell>{request.branchName || '-'}</TableCell>
                          <TableCell className="max-w-xs truncate" title={request.deletionReason}>
                            {request.deletionReason}
                          </TableCell>
                          <TableCell>{request.requestedByName || '-'}</TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell>{request.processedByName || '-'}</TableCell>
                          <TableCell className="max-w-xs truncate" title={request.adminNotes || ''}>
                            {request.adminNotes || '-'}
                          </TableCell>
                          <TableCell>
                            {request.processedAt ? new Date(request.processedAt).toLocaleDateString('ar-SA') : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* نافذة الموافقة */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                تأكيد الموافقة على الحذف
              </DialogTitle>
              <DialogDescription>
                سيتم حذف الزيارة نهائياً من النظام. هل أنت متأكد؟
              </DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p><strong>العميل:</strong> {selectedRequest.customerName}</p>
                  <p><strong>رقم الجوال:</strong> {selectedRequest.customerPhone}</p>
                  <p><strong>الفرع:</strong> {selectedRequest.branchName || '-'}</p>
                  <p><strong>سبب الحذف:</strong> {selectedRequest.deletionReason}</p>
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات الأدمن (اختياري)</Label>
                  <Textarea
                    placeholder="أضف ملاحظاتك هنا..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                إلغاء
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (selectedRequest) {
                    approveMutation.mutate({
                      requestId: selectedRequest.id,
                      adminNotes: adminNotes || undefined,
                    });
                  }
                }}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جاري الموافقة...
                  </>
                ) : (
                  'تأكيد الموافقة والحذف'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* نافذة الرفض */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                رفض طلب الحذف
              </DialogTitle>
              <DialogDescription>
                سيتم رفض طلب الحذف وستبقى الزيارة في النظام.
              </DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p><strong>العميل:</strong> {selectedRequest.customerName}</p>
                  <p><strong>سبب طلب الحذف:</strong> {selectedRequest.deletionReason}</p>
                </div>
                <div className="space-y-2">
                  <Label>سبب الرفض <span className="text-red-500">*</span></Label>
                  <Textarea
                    placeholder="أدخل سبب رفض طلب الحذف..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                إلغاء
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  if (selectedRequest && adminNotes.trim().length >= 5) {
                    rejectMutation.mutate({
                      requestId: selectedRequest.id,
                      adminNotes: adminNotes.trim(),
                    });
                  }
                }}
                disabled={rejectMutation.isPending || adminNotes.trim().length < 5}
              >
                {rejectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جاري الرفض...
                  </>
                ) : (
                  'رفض الطلب'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
