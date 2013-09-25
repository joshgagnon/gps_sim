import threading
import webbrowser
import BaseHTTPServer
import SimpleHTTPServer
import gtk
import webkit
import time
import signal
import serial
import os,re,urllib,urlparse,tempfile,sys

FILE = ''
PORT = 6543

output_gps = None
output_booms = None
no_serial = True

def assign_serial():
    global output_gps
    global output_booms
    print "Looking for serial..."
    while 1:
        devices = ' '.join(os.listdir('/dev/'))
        usb = sorted(re.findall('(ttyUSB[0-9]+)', devices))
        if len(usb) < 1:
            time.sleep(1)
            continue
        output_gps = serial.Serial('/dev/'+usb[0],38400)
        output_booms = serial.Serial('/dev/'+usb[1],38400)
        print "Serial found."
        return

class Handler(SimpleHTTPServer.SimpleHTTPRequestHandler):

    def do_POST(self):
        length = int(self.headers.getheader('content-length'))
        post_data = urlparse.parse_qs(urllib.unquote(self.rfile.read(length)))
        print post_data
        if 'stream' in post_data:
            data_string = post_data['stream'][0]
            try:
                if "$GPRMC" in data_string:
                    output_gps.write(data_string)
                    self.wfile.write("Success")
                else:
                    output_booms.write(data_string)
                    self.wfile.write("Success")
            except:
                if not no_serial:
                    assign_serial()
                self.wfile.write("Error Beep Beep")

        elif 'bounce' in post_data:
            data_string = post_data['bounce'][0]
            self.send_response(200)
            self.send_header('Content-type', 'application/gps_macro');
            self.send_header('Content-disposition',
                             'attachtment; filename=macro.mac');
            self.end_headers()
            self.wfile.write(data_string)



class View(threading.Thread):

    def __init__(self):
        threading.Thread.__init__(self)

    def run(self):
        time.sleep(0.5)
        gtk.gdk.threads_enter()
        self.win=gtk.Window()
        gtk.gdk.threads_leave()
        self.browser=webkit.WebView()
        self.browser.open('http://localhost:%s/%s' % (PORT, FILE))
        self.win.add(self.browser)
        self.browser.show()
        self.win.set_default_size(1015,595);
        self.win.show()
        gtk.gdk.threads_enter()
        gtk.gdk.threads_init()
        self.win.connect("destroy",clean_up);
        gtk.main()
        gtk.gdk.threads_leave()

def start_server():
    """Start the server."""
    global server
    server_address = ("", PORT)
    server = BaseHTTPServer.HTTPServer(server_address, Handler)
    server.serve_forever()

def clean_up(blah):
    gtk.main_quit()
    server.shutdown()

if __name__ == "__main__":
    if 'help' in ''.join(sys.argv):
        print 'Use --no-serial to disable serial out'
        print '    --no-gtk to disable gtk browser'
    if '--no-serial' not in sys.argv:
        no_serial = False
        assign_serial()
    if '--no-gtk' not in sys.argv:
        view = View()
        view.start()
    start_server()

