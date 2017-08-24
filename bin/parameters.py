import csv
import json
import hashlib


class Error(Exception):
  pass


def log(msg, *args):
  if args:
    msg = msg % args
  print >>sys.stderr, msg

class Params(object):
  """RAPPOR encoding parameters.

  These affect privacy/anonymity.  See the paper for details.
  """
  def __init__(self):
    self.num_bloombits = 16      # Number of bloom filter bits (k)
    self.num_hashes = 2          # Number of bloom filter hashes (h)
    self.num_cohorts = 64        # Number of cohorts (m)
    self.prob_p = 0.50           # Probability p
    self.prob_q = 0.75           # Probability q
    self.prob_f = 0.50           # Probability f

  # For testing
  def __eq__(self, other):
    return self.__dict__ == other.__dict__

  def __repr__(self):
    return repr(self.__dict__)

  def to_json(self):
    """Convert this instance to JSON.

    The names are be compatible with the apps/api server.
    """
    return json.dumps({
        'numBits': self.num_bloombits,
        'numHashes': self.num_hashes,
        'numCohorts': self.num_cohorts,
        'probPrr': self.prob_f,
        'probIrr0': self.prob_p,
        'probIrr1': self.prob_q,
    })
    
  @staticmethod
  def from_csv(f):
    """Read the RAPPOR parameters from a CSV file.

    Args:
      f: file handle

    Returns:
      Params instance.

    Raises:
      rappor.Error: when the file is malformed.
    """
    c = csv.reader(f)
    ok = False
    p = Params()
    for i, row in enumerate(c):

      if i == 0:
        if row != ['k', 'h', 'm', 'p', 'q', 'f']:
          raise Error('Header %s is malformed; expected k,h,m,p,q,f' % row)

      elif i == 1:
        try:
          # NOTE: May raise exceptions
          p.num_bloombits = int(row[0])
          p.num_hashes = int(row[1])
          p.num_cohorts = int(row[2])
          p.prob_p = float(row[3])
          p.prob_q = float(row[4])
          p.prob_f = float(row[5])
        except (ValueError, IndexError) as e:
          raise Error('Row is malformed: %s' % e)
        ok = True

      else:
        raise Error('Params file should only have two rows')

    if not ok:
      raise Error("Expected second row with params")

    return p

def get_bloom_bits(word, cohort, num_hashes, num_bloombits):
  """Return an array of bits to set in the bloom filter.
  In the real report, we bitwise-OR them together.  In hash candidates, we put
  them in separate entries in the "map" matrix.
  """
  value = to_big_endian(cohort) + word  # Cohort is 4 byte prefix.
  md5 = hashlib.md5(value)
  digest = md5.digest()
  # Each hash is a byte, which means we could have up to 256 bit Bloom filters.
  # There are 16 bytes in an MD5, in which case we can have up to 16 hash
  # functions per Bloom filter.
  if num_hashes > len(digest):
    raise RuntimeError("Can't have more than %d hashes" % md5)
  #log('hash_input %r', value)
  #log('Cohort %d', cohort)
  #log('MD5 %s', md5.hexdigest())
  return [ord(digest[i]) % num_bloombits for i in xrange(num_hashes)]

def _dump(n): 
  s = '%x' % n
  if len(s) & 1:
    s = '0' + s
  return s.decode('hex')

def to_big_endian(i):
  """Convert an integer to a 4 byte big endian string.  Used for hashing."""
  # https://docs.python.org/2/library/struct.html
  # - Big Endian (>) for consistent network byte order.
  # - L means 4 bytes when using >
  return _dump(i)